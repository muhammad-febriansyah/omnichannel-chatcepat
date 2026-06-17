package channels

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
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
		cli.AddEventHandler(w.handler(cid, info.TenantID))
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
	cli.AddEventHandler(w.handler(channelID, tenantID))

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

	resp, err := sess.cli.SendMessage(ctx, to, &waE2E.Message{Conversation: proto.String(body)})
	if err != nil {
		return "", fmt.Errorf("whatsmeow send: %w", err)
	}
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
	cli.AddEventHandler(w.handler(channelID, info.TenantID))
	if err := cli.Connect(); err != nil {
		return nil, fmt.Errorf("whatsmeow connect: %w", err)
	}
	sess := &waSession{cli: cli, channelID: channelID, tenantID: info.TenantID}
	w.put(channelID, sess)
	return sess, nil
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
func (w *Whatsmeow) handler(channelID, tenantID string) func(any) {
	return func(evt any) {
		msg, ok := evt.(*events.Message)
		if !ok || msg.Info.IsFromMe {
			return
		}
		body := extractText(msg.Message)
		if body == "" {
			return // hanya teks untuk saat ini (docs/prd/04)
		}

		sender := msg.Info.Sender.User
		pmID := msg.Info.ID
		name := optName(msg.Info.PushName)
		inb := contracts.InboundMessage{
			ChannelId:         channelID,
			ChannelType:       contracts.ChannelTypeWaUnofficial,
			EventId:           fmt.Sprintf("%d", time.Now().UnixNano()),
			DedupKey:          channelID + ":" + pmID,
			ProviderMessageId: pmID,
			From:              contracts.Party{ExternalId: sender, Name: name},
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
