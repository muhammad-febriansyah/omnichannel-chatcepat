package channels

import (
	"context"
	"fmt"
	"log"
	"math/rand"
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

// InboundPublisher = bagian Bus yang dipakai untuk push pesan masuk WA unofficial.
type InboundPublisher interface {
	PublishInbound(ctx context.Context, msg *contracts.InboundMessage) (string, error)
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
	bus       InboundPublisher
	store     Resolver
	log       waLog.Logger

	mu      sync.Mutex
	clients map[string]*waSession // channelID → sesi aktif
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
func NewWhatsmeow(ctx context.Context, dsn string, b InboundPublisher, store Resolver) (*Whatsmeow, error) {
	if dsn == "" {
		return nil, nil
	}
	// Nama yang tampil di WhatsApp → Perangkat Tertaut. Default library = "whatsmeow";
	// pakai brand "ChatCepat". Hanya berlaku untuk pairing baru (perangkat lama tetap).
	wstore.DeviceProps.Os = proto.String("ChatCepat")

	logger := waLog.Stdout("whatsmeow", "WARN", true)
	container, err := sqlstore.New(ctx, "postgres", dsn, logger)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow sqlstore: %w", err)
	}
	return &Whatsmeow{
		container: container,
		bus:       b,
		store:     store,
		log:       logger,
		clients:   make(map[string]*waSession),
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
func (w *Whatsmeow) PairDevice(channelID, tenantID string) (<-chan PairEvent, error) {
	if w == nil {
		return nil, fmt.Errorf("whatsmeow nonaktif (DATABASE_URL_SYNC kosong)")
	}
	device := w.container.NewDevice()
	cli := whatsmeow.NewClient(device, w.log)
	cli.AddEventHandler(w.handler(cli, channelID, tenantID))

	// QR loop hidup di luar request (background), jadi pakai context sendiri.
	qrChan, err := cli.GetQRChannel(context.Background())
	if err != nil {
		return nil, fmt.Errorf("qr channel: %w", err)
	}
	if err := cli.Connect(); err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}

	out := make(chan PairEvent)
	go func() {
		defer close(out)
		for item := range qrChan {
			switch {
			case item.Event == "code":
				out <- PairEvent{QR: item.Code}
			case item.Error != nil:
				out <- PairEvent{Err: item.Error}
				cli.Disconnect()
				return
			case cli.Store.ID != nil:
				jid := cli.Store.ID.String()
				w.put(channelID, &waSession{cli: cli, channelID: channelID, tenantID: tenantID})
				out <- PairEvent{JID: jid, Done: true}
				return
			default:
				// timeout / batal sebelum sukses.
				out <- PairEvent{Err: fmt.Errorf("pairing berakhir: %s", item.Event)}
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
	if body == "" {
		return "", fmt.Errorf("whatsmeow: body kosong")
	}

	// Anti-banned: tampil natural sebelum kirim — online + indikator "ngetik"
	// selama durasi proporsional panjang teks. Jeda antar-pesan (broadcast)
	// diatur engine (07); ini menambah realisme per-pesan. Best-effort.
	simulateTyping(ctx, sess.cli, to, len(body))

	resp, err := sess.cli.SendMessage(ctx, to, &waE2E.Message{Conversation: proto.String(body)})
	if err != nil {
		return "", fmt.Errorf("whatsmeow send: %w", err)
	}

	// Anti-banned: setelah kirim, "tutup app" — kembali offline setelah jeda acak,
	// bukan online 24/7 (bot tell). Async best-effort; pakai ctx sendiri karena
	// ctx pemanggil selesai begitu Send return.
	go goOfflineLater(sess.cli)
	return string(resp.ID), nil
}

// ensure mengembalikan sesi tersambung; lazy-restore dari sqlstore via device_jid.
func (w *Whatsmeow) ensure(ctx context.Context, channelID string, creds Credentials) (*waSession, error) {
	w.mu.Lock()
	if s, ok := w.clients[channelID]; ok && s.cli.IsConnected() {
		w.mu.Unlock()
		return s, nil
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
func markReadHumanlike(cli *whatsmeow.Client, info types.MessageInfo) {
	secs := 2.0 + rand.Float64()*13.0
	time.Sleep(time.Duration(secs * float64(time.Second)))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = cli.MarkRead(ctx, []types.MessageID{info.ID}, time.Now(), info.Chat, info.Sender)
}

// goOfflineLater mengembalikan presence ke unavailable setelah jeda acak 4–12 detik
// pasca-kirim — meniru manusia yang menutup aplikasi, bukan online terus-menerus.
// Best-effort; dijalankan di goroutine sendiri dengan context lepas dari pemanggil.
func goOfflineLater(cli *whatsmeow.Client) {
	secs := 4.0 + rand.Float64()*8.0
	time.Sleep(time.Duration(secs * float64(time.Second)))
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
	w.mu.Unlock()
}

// handler mengubah pesan masuk WA → contracts.InboundMessage → bus (idempoten via DedupKey).
func (w *Whatsmeow) handler(cli *whatsmeow.Client, channelID, tenantID string) func(any) {
	return func(evt any) {
		msg, ok := evt.(*events.Message)
		if !ok || msg.Info.IsFromMe {
			return
		}
		body := extractText(msg.Message)
		if body == "" {
			return // hanya teks untuk saat ini (docs/prd/04)
		}

		// Anti-banned: tampil manusiawi — tandai pesan "dibaca" (centang biru)
		// setelah jeda acak, bukan instan (bot tell) dan bukan tak pernah. Async,
		// best-effort, tak boleh menahan handler atau menggagalkan inbound.
		go markReadHumanlike(cli, msg.Info)

		// WA baru pakai LID (id tersembunyi) di Sender; nomor asli (PN) ada di SenderAlt.
		// Wajib pakai PN — kalau LID, balasan dikirim ke <lid>@s.whatsapp.net (gagal,
		// "privacy token 400") + kontak tak match percakapan keluar (yang simpan phone).
		sender := senderPhone(msg.Info)
		pmID := msg.Info.ID
		name := optName(msg.Info.PushName)
		phone := sender
		inb := contracts.InboundMessage{
			ChannelId:         channelID,
			ChannelType:       contracts.ChannelTypeWaUnofficial,
			EventId:           fmt.Sprintf("%d", time.Now().UnixNano()),
			DedupKey:          channelID + ":" + pmID,
			ProviderMessageId: pmID,
			From:              contracts.Party{ExternalId: sender, Phone: &phone, Name: name},
			Type:              contracts.InboundMessageTypeText,
			Body:              &body,
			Timestamp:         msg.Info.Timestamp.UTC(),
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := w.bus.PublishInbound(ctx, &inb); err != nil {
			log.Printf("whatsmeow publish inbound gagal: %v", err)
		}
	}
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
	return ""
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

// memastikan Bus memenuhi InboundPublisher (compile-time).
var _ InboundPublisher = (*bus.Bus)(nil)
