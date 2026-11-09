package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	wstore "go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	_ "github.com/lib/pq"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/chatcepat/gateway/internal/contracts"
)

// EventBus = bagian Bus yang dipakai adapter WA unofficial: push pesan masuk +
// event realtime ke dashboard (mis. channel.status saat nomor banned/logout).
type EventBus interface {
	PublishInbound(ctx context.Context, msg *contracts.InboundMessage) (string, error)
	PublishRealtime(ctx context.Context, tenantID string, payload []byte) error
}

// Whatsmeow adapter WA unofficial (docs/prd/04). Sesi device disimpan di sqlstore
// (tabel milik whatsmeow, BUKAN tabel domain — gateway tidak menulis tabel domain).
// Satu device = satu channel. JID device dipersist web sebagai channels.external_id
// setelah pairing; gateway reverse-lookup JID→channel via Resolver.
//
// Lifecycle:
//   - PairDevice: device baru → QR → scan → tersambung; handler inbound aktif.
//   - Restore (startup): tiap device tersimpan → connect ulang + handler.
//   - Send: pastikan client tersambung (lazy dari sqlstore) → SendMessage.
//
// Reconnect/backoff ditangani whatsmeow (auto-reconnect default aktif). Throttle
// anti-banned untuk broadcast ada di engine (07); balasan 1:1 organik tak di-throttle.
type Whatsmeow struct {
	container *sqlstore.Container
	bus       EventBus
	store     Resolver
	log       waLog.Logger
	sink      ChannelStatusSink // opsional: persist channels.status durable (via web)
	media     MediaSink         // opsional: simpan lampiran masuk (via web) → tampil di inbox

	mu          sync.Mutex
	clients     map[string]*waSession // channelID → sesi aktif
	quarantined map[string]time.Time  // channelID → tolak reconnect s/d (anti reconnect-storm ke nomor banned)

	reads    readTracker // pesan masuk yang belum ditandai dibaca
	presence presenceGen // cegah offline/online berkedip antar balasan beruntun
}

// SetStatusSink memasang sink persist status durable (nil = hanya realtime).
func (w *Whatsmeow) SetStatusSink(s ChannelStatusSink) {
	if w == nil {
		return
	}
	w.sink = s
}

// SetMediaSink memasang penyimpan lampiran masuk. nil = media masuk hanya tampil
// sebagai teks placeholder (mis. "[Foto]").
func (w *Whatsmeow) SetMediaSink(s MediaSink) {
	if w == nil {
		return
	}
	w.media = s
}

type waSession struct {
	cli       *whatsmeow.Client
	channelID string
	tenantID  string
}

// PairEvent dikirim ke pemanggil pairing (server SSE) selama proses scan QR.
type PairEvent struct {
	QR   string // kode QR mentah untuk dirender jadi gambar di frontend
	JID  string // terisi saat pairing sukses (device JID) — web simpan ke channel
	Err  error
	Done bool
}

// NewWhatsmeow membuka sqlstore Postgres. dsn kosong → return (nil, nil): fitur
// WA unofficial nonaktif, Send/Pair akan menolak dengan rapi.
func NewWhatsmeow(ctx context.Context, dsn string, b EventBus, store Resolver) (*Whatsmeow, error) {
	if dsn == "" {
		return nil, nil
	}
	// Nama yang tampil di WhatsApp → Perangkat Tertaut. Default library = "whatsmeow";
	// pakai brand "ChatCepat". Hanya berlaku untuk pairing baru (perangkat lama tetap).
	wstore.DeviceProps.Os = proto.String("ChatCepat")

	// WhatsApp rejects old client versions ("Client outdated (405)"), which blocks every
	// QR pairing and reconnect. Use the current WhatsApp Web version instead of the one
	// compiled into the library, and keep it fresh.
	refreshWAVersion(ctx)
	go func() {
		t := time.NewTicker(6 * time.Hour)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				refreshWAVersion(ctx)
			}
		}
	}()

	logger := waLog.Stdout("whatsmeow", "WARN", true)
	container, err := sqlstore.New(ctx, "postgres", dsn, logger)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow sqlstore: %w", err)
	}
	return &Whatsmeow{
		container:   container,
		bus:         b,
		store:       store,
		log:         logger,
		clients:     make(map[string]*waSession),
		quarantined: make(map[string]time.Time),
	}, nil
}

func (w *Whatsmeow) Type() contracts.ChannelType { return contracts.ChannelTypeWaUnofficial }

// Restore menyambung ulang semua device tersimpan saat startup. Best-effort:
// device yang belum dipetakan ke channel (web belum simpan external_id) dilewati.
func (w *Whatsmeow) Restore(ctx context.Context) {
	if w == nil {
		return
	}
	devices, err := w.container.GetAllDevices(ctx)
	if err != nil {
		log.Printf("whatsmeow restore: %v", err)
		return
	}
	for _, d := range devices {
		if d.ID == nil {
			continue
		}
		jid := d.ID.String()
		cid, info, err := w.store.LookupByExternal(ctx, contracts.ChannelTypeWaUnofficial, jid)
		if err != nil {
			log.Printf("whatsmeow restore: device %s belum dipetakan ke channel, skip", jid)
			continue
		}
		cli := whatsmeow.NewClient(d, w.log)
		cli.AddEventHandler(w.handler(cli, cid, info.TenantID))
		if err := cli.Connect(); err != nil {
			log.Printf("whatsmeow restore connect %s: %v", jid, err)
			continue
		}
		w.put(cid, &waSession{cli: cli, channelID: cid, tenantID: info.TenantID})
		log.Printf("whatsmeow restore: channel %s tersambung (%s)", cid, jid)
	}
}

// PairDevice memulai sesi baru dan mengalirkan QR sampai sukses/gagal. Pada sukses,
// client disimpan & handler inbound aktif; web menyimpan PairEvent.JID ke channel.
// ctx = umur halaman QR: kalau ditutup sebelum scan, koneksi WA dilepas (tidak
// menggantung selamanya).
func (w *Whatsmeow) PairDevice(ctx context.Context, channelID, tenantID string) (<-chan PairEvent, error) {
	if w == nil {
		return nil, fmt.Errorf("whatsmeow nonaktif (DATABASE_URL_SYNC kosong)")
	}
	device := w.container.NewDevice()
	cli := whatsmeow.NewClient(device, w.log)
	cli.AddEventHandler(w.handler(cli, channelID, tenantID))
	// Connection refused by WhatsApp before any QR (e.g. client outdated, temp ban):
	// the QR channel stays silent, so surface it to the pairing page explicitly.
	failCh := make(chan error, 1)
	cli.AddEventHandler(func(evt any) {
		var err error
		switch e := evt.(type) {
		case *events.ClientOutdated:
			err = fmt.Errorf("WhatsApp menolak versi klien (client outdated). Coba lagi beberapa menit lagi")
		case *events.ConnectFailure:
			err = fmt.Errorf("WhatsApp menolak koneksi (%s)", e.Reason.String())
		case *events.TemporaryBan:
			err = fmt.Errorf("nomor sedang diblokir sementara oleh WhatsApp: %s", e.String())
		}
		if err != nil {
			select {
			case failCh <- err:
			default:
			}
		}
	})

	// QR loop hidup di luar request (background), jadi pakai context sendiri.
	qrChan, err := cli.GetQRChannel(context.Background())
	if err != nil {
		return nil, fmt.Errorf("qr channel: %w", err)
	}
	if err := cli.Connect(); err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	out := make(chan PairEvent)
	// emit returns false once the page is gone, so the loop never blocks on a reader
	// that will not come back.
	emit := func(ev PairEvent) bool {
		select {
		case out <- ev:
			return true
		case <-ctx.Done():
			return false
		}
	}
	go func() {
		defer close(out)
		for {
			var item whatsmeow.QRChannelItem
			var ok bool
			select {
			case <-ctx.Done():
				cli.Disconnect()
				return
			case err := <-failCh:
				emit(PairEvent{Err: err})
				cli.Disconnect()
				return
			case item, ok = <-qrChan:
				if !ok {
					return
				}
			}
			switch {
			case item.Event == "code":
				if !emit(PairEvent{QR: item.Code}) {
					cli.Disconnect()
					return
				}
			case item.Error != nil:
				emit(PairEvent{Err: item.Error})
				cli.Disconnect()
				return
			case cli.Store.ID != nil:
				jid := cli.Store.ID.String()
				w.put(channelID, &waSession{cli: cli, channelID: channelID, tenantID: tenantID})
				if !emit(PairEvent{JID: jid, Done: true}) {
					log.Printf("whatsmeow: channel %s ter-pair (%s) tapi halaman QR sudah ditutup — JID belum tersimpan, ulangi pairing", channelID, jid)
				}
				return
			default:
				// timeout / batal sebelum sukses.
				emit(PairEvent{Err: fmt.Errorf("pairing berakhir: %s", item.Event)})
				cli.Disconnect()
				return
			}
		}
	}()
	return out, nil
}

// Send mengirim teks lewat client WA yang tersambung untuk channel ini.
func (w *Whatsmeow) Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (string, error) {
	if w == nil {
		return "", fmt.Errorf("whatsmeow nonaktif (DATABASE_URL_SYNC kosong)")
	}
	sess, err := w.ensure(ctx, cmd.ChannelId, creds)
	if err != nil {
		return "", err
	}

	to, err := parseRecipient(cmd.To.ExternalId)
	if err != nil {
		return "", err
	}
	body := ""
	if cmd.Body != nil {
		body = *cmd.Body
	}
	media := outboundMedia(cmd)
	if body == "" && media == nil {
		return "", fmt.Errorf("whatsmeow: body kosong")
	}

	gen := w.presence.bump(cmd.ChannelId)

	// Anti-banned: balasan tak boleh tiba sebelum pesan pelanggan terbaca (centang
	// biru) — ciri khas bot. Tandai dibaca dulu pesan yang masih tertunda di chat ini.
	if unread := w.reads.takeChat(cmd.ChannelId, to.User); len(unread) > 0 {
		markReadNow(ctx, sess.cli, unread)
	}

	// Anti-banned: tampil natural sebelum kirim — online + indikator "ngetik"
	// selama durasi proporsional panjang teks. Jeda antar-pesan (broadcast)
	// diatur engine (07); ini menambah realisme per-pesan. Best-effort.
	simulateTyping(ctx, sess.cli, to, len(body))

	msg := &waE2E.Message{Conversation: proto.String(body)}
	if media != nil {
		msg, err = buildMediaMessage(ctx, sess.cli, media, body)
		if err != nil {
			return "", err
		}
	}
	resp, err := sess.cli.SendMessage(ctx, to, msg)
	if err != nil {
		return "", fmt.Errorf("whatsmeow send: %w", err)
	}

	// Anti-banned: setelah kirim, "tutup app" — kembali offline setelah jeda acak,
	// bukan online 24/7 (bot tell). Async best-effort; pakai ctx sendiri karena
	// ctx pemanggil selesai begitu Send return.
	go w.goOfflineLater(sess.cli, cmd.ChannelId, gen)
	return string(resp.ID), nil
}

// ensure mengembalikan sesi tersambung; lazy-restore dari sqlstore via device_jid.
func (w *Whatsmeow) ensure(ctx context.Context, channelID string, creds Credentials) (*waSession, error) {
	w.mu.Lock()
	if s, ok := w.clients[channelID]; ok && s.cli.IsConnected() {
		w.mu.Unlock()
		return s, nil
	}
	// Anti-banned: dalam window karantina, tolak reconnect (jangan hantam nomor
	// yang sedang di-ban ulang-ulang). Window lewat → hapus, boleh coba lagi.
	if until, ok := w.quarantined[channelID]; ok {
		if time.Now().Before(until) {
			w.mu.Unlock()
			return nil, fmt.Errorf("whatsmeow: channel %s dikarantina (banned/logout) s/d %s",
				channelID, until.Format(time.RFC3339))
		}
		delete(w.quarantined, channelID)
	}
	w.mu.Unlock()

	jidStr := creds.String("device_jid")
	if jidStr == "" {
		return nil, fmt.Errorf("whatsmeow: channel %s belum di-pair (device_jid kosong)", channelID)
	}
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow: device_jid invalid: %w", err)
	}
	device, err := w.container.GetDevice(ctx, jid)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow: ambil device %s: %w", jidStr, err)
	}
	if device == nil {
		return nil, fmt.Errorf("whatsmeow: device %s tidak ada di store", jidStr)
	}

	info, err := w.store.Lookup(ctx, channelID)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow: lookup channel %s: %w", channelID, err)
	}

	cli := whatsmeow.NewClient(device, w.log)
	cli.AddEventHandler(w.handler(cli, channelID, info.TenantID))
	if err := cli.Connect(); err != nil {
		return nil, fmt.Errorf("whatsmeow connect: %w", err)
	}
	sess := &waSession{cli: cli, channelID: channelID, tenantID: info.TenantID}
	w.put(channelID, sess)
	return sess, nil
}

// simulateTyping meniru perilaku manusia sebelum kirim. Bukan satu blok "composing"
// lurus (ciri bot), tapi ketik–jeda-mikir–ketik dalam beberapa burst: indikator
// "typing…" berkedip seperti orang asli yang mengetik, berhenti memikirkan kalimat,
// lalu lanjut. Jumlah burst proporsional panjang teks. Best-effort — error presence
// diabaikan, tak boleh menggagalkan pengiriman. ctx dibatalkan → langsung lanjut kirim.
func simulateTyping(ctx context.Context, cli *whatsmeow.Client, to types.JID, bodyLen int) {
	// 1) Online dulu, lalu jeda "membaca" singkat sebelum mulai mengetik
	//    (manusia tidak langsung ngetik begitu chat terbuka).
	_ = cli.SendPresence(ctx, types.PresenceAvailable)
	if !sleepCtx(ctx, readDelay()) {
		return
	}

	// 2) Total waktu mengetik aktif, dibagi rata ke beberapa burst. Antar-burst ada
	//    jeda "berpikir": indikator paused sejenak (typing… hilang), lalu composing lagi.
	bursts := typingBursts(bodyLen)
	perBurst := typingDelay(bodyLen) / time.Duration(bursts)
	for i := 0; i < bursts; i++ {
		_ = cli.SendChatPresence(ctx, to, types.ChatPresenceComposing, types.ChatPresenceMediaText)
		if !sleepCtx(ctx, jitterAround(perBurst)) {
			_ = cli.SendChatPresence(ctx, to, types.ChatPresencePaused, types.ChatPresenceMediaText)
			return
		}
		if i < bursts-1 {
			// Jeda berpikir/re-read di tengah: berhenti ngetik sebentar (typing… hilang).
			_ = cli.SendChatPresence(ctx, to, types.ChatPresencePaused, types.ChatPresenceMediaText)
			if !sleepCtx(ctx, thinkPause()) {
				return
			}
		}
	}
	_ = cli.SendChatPresence(ctx, to, types.ChatPresencePaused, types.ChatPresenceMediaText)
}

// sleepCtx tidur selama d, atau berhenti lebih awal bila ctx dibatalkan. Return
// false bila ctx batal (pemanggil sebaiknya langsung lanjut kirim).
func sleepCtx(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}

// typingBursts: 1 burst untuk pesan pendek, naik ~1 tiap 45 char, dibatasi 4. Pesan
// panjang → lebih banyak jeda mikir di tengah (lebih manusiawi).
func typingBursts(bodyLen int) int {
	n := 1 + bodyLen/45
	if n > 4 {
		n = 4
	}
	return n
}

// thinkPause: jeda berpikir antar-burst, acak 0.4–1.6 detik.
func thinkPause() time.Duration {
	secs := 0.4 + rand.Float64()*1.2
	return time.Duration(secs * float64(time.Second))
}

// jitterAround memberi variasi ±25% pada durasi d (kecepatan ketik tak pernah konstan).
func jitterAround(d time.Duration) time.Duration {
	factor := 0.75 + rand.Float64()*0.5 // 0.75–1.25
	return time.Duration(float64(d) * factor)
}

// readDelay: jeda acak 0.8–2.5 detik meniru waktu "membaca" sebelum mengetik.
func readDelay() time.Duration {
	secs := 0.8 + rand.Float64()*1.7
	return time.Duration(secs * float64(time.Second))
}

// typingDelay: kira-kira 3.3 char/detik (≈200 char/menit, kecepatan ketik manusia)
// + jitter acak 0.5–2.0 detik, dibatasi [1.5s, 8s] agar pesan panjang tak menahan
// worker terlalu lama.
func typingDelay(bodyLen int) time.Duration {
	secs := float64(bodyLen)/3.3 + 0.5 + rand.Float64()*1.5
	if secs < 1.5 {
		secs = 1.5
	}
	if secs > 8.0 {
		secs = 8.0
	}
	return time.Duration(secs * float64(time.Second))
}

// markReadHumanlike menandai pesan masuk "dibaca" (centang biru) setelah jeda acak
// 2–15 detik — meniru manusia yang melihat notif lalu membuka chat, bukan bot yang
// membaca instan atau tak pernah. Best-effort: error presence/receipt diabaikan.
func (w *Whatsmeow) markReadHumanlike(cli *whatsmeow.Client, channelID string, info types.MessageInfo) {
	secs := 2.0 + rand.Float64()*13.0
	time.Sleep(time.Duration(secs * float64(time.Second)))
	// Already marked read by a reply in the meantime → nothing to do.
	if _, ok := w.reads.take(channelID, info.ID); !ok {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = cli.MarkRead(ctx, []types.MessageID{info.ID}, time.Now(), info.Chat, info.Sender)
}

// markReadNow marks pending messages read right before a reply, grouped per chat.
func markReadNow(ctx context.Context, cli *whatsmeow.Client, infos []types.MessageInfo) {
	type key struct{ chat, sender types.JID }
	groups := map[key][]types.MessageID{}
	for _, in := range infos {
		k := key{in.Chat, in.Sender}
		groups[k] = append(groups[k], in.ID)
	}
	for k, ids := range groups {
		_ = cli.MarkRead(ctx, ids, time.Now(), k.chat, k.sender)
	}
	// A short "opened the chat" pause before typing starts.
	sleepCtx(ctx, time.Duration((0.6+rand.Float64()*1.2)*float64(time.Second)))
}

// goOfflineLater mengembalikan presence ke unavailable setelah jeda acak 4–12 detik
// pasca-kirim — meniru manusia yang menutup aplikasi, bukan online terus-menerus.
// Best-effort; dijalankan di goroutine sendiri dengan context lepas dari pemanggil.
func (w *Whatsmeow) goOfflineLater(cli *whatsmeow.Client, channelID string, gen uint64) {
	secs := 4.0 + rand.Float64()*8.0
	time.Sleep(time.Duration(secs * float64(time.Second)))
	// Another reply started meanwhile → still "in the app", stay online.
	if w.presence.current(channelID) != gen {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = cli.SendPresence(ctx, types.PresenceUnavailable)
}

func (w *Whatsmeow) put(channelID string, s *waSession) {
	w.mu.Lock()
	if old, ok := w.clients[channelID]; ok && old.cli != s.cli {
		old.cli.Disconnect()
	}
	w.clients[channelID] = s
	delete(w.quarantined, channelID) // (re)pair/connect sukses → keluar karantina
	w.mu.Unlock()
}

// handler mem-fan-out event whatsmeow: pesan masuk → bus, dan event putus permanen
// (banned/logout/outdated/replaced) → karantina anti-banned. whatsmeow menangani
// reconnect transient sendiri; yang ditangani di sini hanya yang TIDAK auto-reconnect.
func (w *Whatsmeow) handler(cli *whatsmeow.Client, channelID, tenantID string) func(any) {
	return func(evt any) {
		switch e := evt.(type) {
		case *events.Message:
			w.handleMessage(cli, channelID, e)
			return
		case *events.Connected:
			// (re)connect sukses — nomor sehat kembali.
			log.Printf("whatsmeow: channel %s tersambung", channelID)
			return
		}
		// events.PermanentDisconnect = kelas event saat whatsmeow TIDAK akan
		// auto-reconnect (LoggedOut, TemporaryBan, ConnectFailure, ClientOutdated,
		// StreamReplaced). Nomor efektif mati/dibatasi → karantina.
		if pd, ok := evt.(events.PermanentDisconnect); ok {
			w.quarantine(channelID, tenantID, evt, pd.PermanentDisconnectDescription())
		}
	}
}

// quarantine menangani putus permanen (anti-banned): lepas sesi basi supaya worker
// berhenti kirim ke nomor banned/dibatasi (untuk TemporaryBan, client bisa masih
// "connected" tapi WA menolak — kalau tak dilepas, tiap kirim menambah sinyal spam),
// lalu kabari dashboard via realtime channel.status. Best-effort.
func (w *Whatsmeow) quarantine(channelID, tenantID string, evt any, desc string) {
	status := banStatus(evt)
	log.Printf("whatsmeow: channel %s %s — %s (karantina, hentikan kirim)", channelID, status, desc)
	w.mu.Lock()
	w.quarantined[channelID] = time.Now().Add(quarantineCooldown(evt))
	w.mu.Unlock()
	w.drop(channelID)
	w.publishChannelStatus(tenantID, channelID, status, desc)
	w.persistChannelStatus(channelID, status, desc)
}

// quarantineCooldown = berapa lama menolak reconnect setelah putus permanen. Untuk
// TemporaryBan pakai durasi ban dari WA (+buffer); sisanya (logout/outdated) butuh
// re-pair manual → cooldown default panjang (dibersihkan saat re-pair via put).
func quarantineCooldown(evt any) time.Duration {
	if tb, ok := evt.(*events.TemporaryBan); ok && tb.Expire > 0 {
		return tb.Expire + time.Minute
	}
	return 30 * time.Minute
}

// persistChannelStatus set channels.status durable via web (best-effort, async).
// Tanpa ini, realtime cuma memicu refresh yang membaca DB lama → badge tak berubah.
func (w *Whatsmeow) persistChannelStatus(channelID, status, reason string) {
	if w.sink == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := w.sink.SetChannelStatus(ctx, channelID, status, reason); err != nil {
			log.Printf("whatsmeow: persist channel.status gagal: %v", err)
		}
	}()
}

// banStatus memetakan event putus permanen ke enum channel_status DB. TemporaryBan =
// "banned" (dibatasi sementara); sisanya (unpair/logout/outdated/replaced) =
// "disconnected". Pure — reason detail dibawa terpisah di payload.
func banStatus(evt any) string {
	if _, ok := evt.(*events.TemporaryBan); ok {
		return "banned"
	}
	return "disconnected"
}

// drop melepas sesi channel dari map dan memutus koneksinya. Setelah ini ensure()
// tak akan mengembalikan client basi; kirim berikutnya gagal rapi (status failed)
// alih-alih menghantam nomor yang sudah banned.
func (w *Whatsmeow) drop(channelID string) {
	w.mu.Lock()
	s, ok := w.clients[channelID]
	if ok {
		delete(w.clients, channelID)
	}
	w.mu.Unlock()
	if ok {
		s.cli.Disconnect()
	}
}

// publishChannelStatus mengirim event realtime channel.status ke dashboard tenant
// (09). Payload dipakai web untuk refresh + tampilkan status nomor. Best-effort.
func (w *Whatsmeow) publishChannelStatus(tenantID, channelID, status, reason string) {
	evt := contracts.RealtimeEvent{
		Type: contracts.RealtimeEventTypeChannelStatus,
		Payload: contracts.RealtimeEventPayload{
			"channel_id": channelID,
			"status":     status,
			"reason":     reason,
		},
	}
	data, err := json.Marshal(evt)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := w.bus.PublishRealtime(ctx, tenantID, data); err != nil {
		log.Printf("whatsmeow: publish channel.status gagal: %v", err)
	}
}

// handleMessage menormalisasi pesan masuk WA → contracts.InboundMessage → bus
// (idempoten via DedupKey).
func (w *Whatsmeow) handleMessage(cli *whatsmeow.Client, channelID string, msg *events.Message) {
	// Hanya chat pribadi. Grup, status, dan saluran (newsletter) bukan percakapan
	// dengan pelanggan — kalau ikut masuk, tiap anggota grup / status kontak jadi
	// percakapan baru dan bisa dibalas bot (spam → rawan banned).
	if msg.Info.IsFromMe || !isDirectChat(msg.Info.Chat) {
		return
	}
	body := extractText(msg.Message)
	att := inboundAttachment(msg.Message)
	if body == "" && att == nil {
		return // reaksi, polling, lokasi, dll. belum didukung
	}

	// Anti-banned: tampil manusiawi — tandai pesan "dibaca" (centang biru)
	// setelah jeda acak, bukan instan (bot tell) dan bukan tak pernah. Async,
	// best-effort, tak boleh menahan handler atau menggagalkan inbound.
	w.reads.add(channelID, msg.Info)
	go w.markReadHumanlike(cli, channelID, msg.Info)

	if att == nil {
		w.publishInbound(channelID, msg.Info, contracts.InboundMessageTypeText, body, nil)
		return
	}
	// Unduh media bisa beberapa detik — jangan tahan event loop whatsmeow.
	go func() {
		media := w.storeAttachment(cli, channelID, att)
		typ, text := contracts.InboundMessageTypeText, body
		switch {
		case media == nil && text == "":
			text = "[" + att.label + "]" // gagal simpan → tetap kelihatan di inbox
		case media != nil && att.image:
			typ = contracts.InboundMessageTypeImage
		case media != nil:
			typ = contracts.InboundMessageTypeFile
		}
		w.publishInbound(channelID, msg.Info, typ, text, media)
	}()
}

// publishInbound menormalisasi pesan masuk → contracts.InboundMessage → bus.
func (w *Whatsmeow) publishInbound(channelID string, info types.MessageInfo, typ contracts.InboundMessageType, body string, media *contracts.Media) {
	// WA baru pakai LID (id tersembunyi) di Sender; nomor asli (PN) ada di SenderAlt.
	// Wajib pakai PN — kalau LID, balasan dikirim ke <lid>@s.whatsapp.net (gagal,
	// "privacy token 400") + kontak tak match percakapan keluar (yang simpan phone).
	sender := senderPhone(info)
	pmID := info.ID
	phone := sender
	inb := contracts.InboundMessage{
		ChannelId:         channelID,
		ChannelType:       contracts.ChannelTypeWaUnofficial,
		EventId:           fmt.Sprintf("%d", time.Now().UnixNano()),
		DedupKey:          channelID + ":" + pmID,
		ProviderMessageId: pmID,
		From:              contracts.Party{ExternalId: sender, Phone: &phone, Name: optName(info.PushName)},
		Type:              typ,
		Timestamp:         info.Timestamp.UTC(),
	}
	if body != "" {
		inb.Body = &body
	}
	if media != nil {
		inb.Media = media
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := w.bus.PublishInbound(ctx, &inb); err != nil {
		log.Printf("whatsmeow publish inbound gagal: %v", err)
	}
}

// isDirectChat: chat pribadi = nomor biasa (@s.whatsapp.net) atau LID (@lid).
// Grup (@g.us), status/broadcast (@broadcast), dan saluran (@newsletter) ditolak.
func isDirectChat(chat types.JID) bool {
	return chat.Server == types.DefaultUserServer || chat.Server == types.HiddenUserServer
}

// waAttachment = lampiran pesan masuk yang bisa diunduh dari WhatsApp.
type waAttachment struct {
	msg      whatsmeow.DownloadableMessage
	mime     string
	filename string
	size     uint64
	image    bool   // tampil sebagai gambar (foto/stiker); sisanya kartu file/pemutar
	label    string // teks pengganti bila gagal disimpan
}

// inboundAttachment mengambil foto/video/audio/dokumen/stiker dari pesan. nil = tak ada.
func inboundAttachment(m *waE2E.Message) *waAttachment {
	if m == nil {
		return nil
	}
	if im := m.GetImageMessage(); im != nil {
		return &waAttachment{msg: im, mime: im.GetMimetype(), size: im.GetFileLength(), image: true, label: "Foto"}
	}
	if st := m.GetStickerMessage(); st != nil {
		return &waAttachment{msg: st, mime: st.GetMimetype(), size: st.GetFileLength(), image: true, label: "Stiker"}
	}
	if vm := m.GetVideoMessage(); vm != nil {
		return &waAttachment{msg: vm, mime: vm.GetMimetype(), size: vm.GetFileLength(), label: "Video"}
	}
	if am := m.GetAudioMessage(); am != nil {
		label := "Audio"
		if am.GetPTT() {
			label = "Pesan suara"
		}
		return &waAttachment{msg: am, mime: am.GetMimetype(), size: am.GetFileLength(), label: label}
	}
	if dm := m.GetDocumentMessage(); dm != nil {
		return &waAttachment{msg: dm, mime: dm.GetMimetype(), filename: dm.GetFileName(), size: dm.GetFileLength(), label: "Dokumen"}
	}
	return nil
}

// storeAttachment mengunduh lampiran dari WhatsApp lalu menyimpannya lewat web.
// nil = tidak disimpan (sink nonaktif, terlalu besar, atau gagal) — best-effort.
func (w *Whatsmeow) storeAttachment(cli *whatsmeow.Client, channelID string, a *waAttachment) *contracts.Media {
	if w.media == nil || a.size > maxMediaBytes {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	data, err := cli.Download(ctx, a.msg)
	if err != nil {
		log.Printf("whatsmeow: unduh media masuk channel %s gagal: %v", channelID, err)
		return nil
	}
	if len(data) > maxMediaBytes {
		return nil
	}
	mime := baseMime(a.mime)
	name := a.filename
	if name == "" {
		name = "whatsapp-" + strings.ToLower(strings.ReplaceAll(a.label, " ", "-"))
	}
	url, err := w.media.SaveInboundMedia(ctx, channelID, data, mime, name)
	if err != nil {
		log.Printf("whatsmeow: simpan media masuk channel %s gagal: %v", channelID, err)
		return nil
	}
	media := &contracts.Media{Url: url, Mime: mime}
	if a.filename != "" {
		fn := a.filename
		media.Filename = &fn
	}
	return media
}

// baseMime membuang parameter MIME ("audio/ogg; codecs=opus" → "audio/ogg").
func baseMime(m string) string {
	m = strings.TrimSpace(strings.SplitN(m, ";", 2)[0])
	if m == "" {
		return "application/octet-stream"
	}
	return strings.ToLower(m)
}

// Close memutus semua client tersambung (graceful shutdown).
func (w *Whatsmeow) Close() {
	if w == nil {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, s := range w.clients {
		s.cli.Disconnect()
	}
}

// senderPhone mengembalikan nomor telepon (PN) pengirim, bukan LID. Bila Sender
// sudah PN (@s.whatsapp.net) pakai itu; bila LID, ambil SenderAlt (PN). Fallback
// ke Sender.User bila PN tak tersedia.
func senderPhone(info types.MessageInfo) string {
	if info.Sender.Server == types.DefaultUserServer {
		return info.Sender.User
	}
	if info.SenderAlt.Server == types.DefaultUserServer && info.SenderAlt.User != "" {
		return info.SenderAlt.User
	}
	return info.Sender.User
}

func extractText(m *waE2E.Message) string {
	if m == nil {
		return ""
	}
	if c := m.GetConversation(); c != "" {
		return c
	}
	if ext := m.GetExtendedTextMessage(); ext != nil {
		return ext.GetText()
	}
	// Caption lampiran ikut jadi teks pesan.
	if c := m.GetImageMessage().GetCaption(); c != "" {
		return c
	}
	if c := m.GetVideoMessage().GetCaption(); c != "" {
		return c
	}
	return m.GetDocumentMessage().GetCaption()
}

func parseRecipient(externalID string) (types.JID, error) {
	if externalID == "" {
		return types.JID{}, fmt.Errorf("whatsmeow: penerima kosong")
	}
	if strings.Contains(externalID, "@") {
		return types.ParseJID(externalID)
	}
	// Nomor telepon (digit) → JID user biasa.
	return types.NewJID(externalID, types.DefaultUserServer), nil
}

func optName(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// memastikan Bus memenuhi EventBus (compile-time).
var _ EventBus = (*bus.Bus)(nil)

// refreshWAVersion asks web.whatsapp.com for its current client version and makes
// whatsmeow announce that version. On failure the built-in version stays.
func refreshWAVersion(ctx context.Context) {
	cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	v, err := whatsmeow.GetLatestVersion(cctx, &http.Client{Timeout: 15 * time.Second})
	if err != nil || v == nil {
		log.Printf("whatsmeow: gagal ambil versi WhatsApp Web terbaru (%v) — pakai versi bawaan %s", err, wstore.GetWAVersion())
		return
	}
	wstore.SetWAVersion(*v)
	log.Printf("whatsmeow: versi klien WhatsApp Web %s", v)
}

// maxMediaBytes caps what the gateway downloads for one WhatsApp attachment.
const maxMediaBytes = 16 << 20

// buildMediaMessage downloads the attachment, uploads it (encrypted) to WhatsApp and
// returns the image / video / audio / document message (caption = text body).
func buildMediaMessage(ctx context.Context, cli *whatsmeow.Client, m *contracts.Media, caption string) (*waE2E.Message, error) {
	data, err := fetchMedia(ctx, m.Url)
	if err != nil {
		return nil, err
	}
	kind := whatsmeow.MediaDocument
	switch {
	case strings.HasPrefix(m.Mime, "image/"):
		kind = whatsmeow.MediaImage
	case strings.HasPrefix(m.Mime, "video/"):
		kind = whatsmeow.MediaVideo
	case strings.HasPrefix(m.Mime, "audio/"):
		kind = whatsmeow.MediaAudio
	}
	up, err := cli.Upload(ctx, data, kind)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow upload media: %w", err)
	}
	var capPtr *string
	if caption != "" {
		capPtr = proto.String(caption)
	}
	switch kind {
	case whatsmeow.MediaImage:
		return &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
			Caption: capPtr, Mimetype: proto.String(m.Mime), URL: proto.String(up.URL), DirectPath: proto.String(up.DirectPath),
			MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: proto.Uint64(up.FileLength),
		}}, nil
	case whatsmeow.MediaVideo:
		return &waE2E.Message{VideoMessage: &waE2E.VideoMessage{
			Caption: capPtr, Mimetype: proto.String(m.Mime), URL: proto.String(up.URL), DirectPath: proto.String(up.DirectPath),
			MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: proto.Uint64(up.FileLength),
		}}, nil
	case whatsmeow.MediaAudio:
		// Audio has no caption on WhatsApp; a text body is dropped here by design.
		return &waE2E.Message{AudioMessage: &waE2E.AudioMessage{
			Mimetype: proto.String(m.Mime), URL: proto.String(up.URL), DirectPath: proto.String(up.DirectPath),
			MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: proto.Uint64(up.FileLength),
		}}, nil
	}
	name := "dokumen"
	if m.Filename != nil && *m.Filename != "" {
		name = *m.Filename
	}
	return &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{
		Caption: capPtr, Mimetype: proto.String(m.Mime), FileName: proto.String(name), Title: proto.String(name),
		URL: proto.String(up.URL), DirectPath: proto.String(up.DirectPath),
		MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256, FileSHA256: up.FileSHA256, FileLength: proto.Uint64(up.FileLength),
	}}, nil
}

// fetchMedia downloads an attachment. Files live on the web app; inside Docker the
// public APP_BASE_URL may not resolve, so it is rewritten to WEB_INTERNAL_URL.
func fetchMedia(ctx context.Context, rawURL string) ([]byte, error) {
	if pub, internal := strings.TrimRight(os.Getenv("APP_BASE_URL"), "/"), strings.TrimRight(os.Getenv("WEB_INTERNAL_URL"), "/"); pub != "" && internal != "" && strings.HasPrefix(rawURL, pub+"/") {
		rawURL = internal + strings.TrimPrefix(rawURL, pub)
	}
	cctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(cctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("unduh lampiran: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unduh lampiran: HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxMediaBytes+1))
	if err != nil {
		return nil, fmt.Errorf("unduh lampiran: %w", err)
	}
	if len(data) > maxMediaBytes {
		return nil, fmt.Errorf("lampiran melebihi 16 MB")
	}
	return data, nil
}
