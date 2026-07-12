// Package server: HTTP publik gateway — webhook receiver + WS. Lihat docs/prd/09.
package server

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/chatcepat/gateway/internal/channels"
	"github.com/chatcepat/gateway/internal/contracts"
	"github.com/chatcepat/gateway/internal/ws"
)

type Server struct {
	Bus           *bus.Bus
	Resolver      channels.Resolver
	WS            *ws.Handler
	WA            *channels.Whatsmeow
	MetaAppSecret string
	MetaVerifyTok string
	ApiCoSecret   string // api.co.id webhook secret (X-Webhook-Signature HMAC-SHA256)
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/webhooks/meta/wa", s.handleMetaWA)
	mux.HandleFunc("/webhooks/meta/ig", s.handleMessenger) // Instagram DM
	mux.HandleFunc("/webhooks/meta/fb", s.handleMessenger) // Facebook Messenger
	mux.HandleFunc("/webhooks/telegram/", s.handleTelegram) // /webhooks/telegram/{channel_id}
	mux.HandleFunc("/webhooks/apico", s.handleApiCo)        // api.co.id (WA/IG/Messenger)
	mux.HandleFunc("/channels/", s.handleChannelOps)        // connect-unofficial / qr (stub)
	if s.WS != nil {
		mux.Handle("/ws", s.WS)
	}
	return mux
}

// --- Meta WA Cloud ---

func (s *Server) handleMetaWA(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		q := r.URL.Query()
		challenge, ok := channels.VerifyChallenge(
			s.MetaVerifyTok, q.Get("hub.mode"), q.Get("hub.verify_token"), q.Get("hub.challenge"),
		)
		if !ok {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		_, _ = w.Write([]byte(challenge))
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	if !channels.VerifySignature(s.MetaAppSecret, body, r.Header.Get("X-Hub-Signature-256")) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	parsed, err := channels.ParseWhatsAppCloud(body)
	if err != nil {
		http.Error(w, "parse error", http.StatusBadRequest)
		return
	}
	for _, p := range parsed {
		cid, _, err := s.Resolver.LookupByExternal(r.Context(), contracts.ChannelTypeWaOfficial, p.PhoneNumberID)
		if err != nil {
			log.Printf("meta webhook: %v", err)
			continue
		}
		inb := p.Inbound
		inb.ChannelId = cid
		inb.EventId = newEventID()
		inb.DedupKey = cid + ":" + inb.ProviderMessageId
		if _, err := s.Bus.PublishInbound(r.Context(), &inb); err != nil {
			log.Printf("publish inbound gagal: %v", err)
		}
	}

	// Delivery/read receipts (value.statuses[]) → message.status.
	statuses, err := channels.ParseWhatsAppStatuses(body)
	if err == nil {
		for i := range statuses {
			if _, err := s.Bus.PublishStatus(r.Context(), &statuses[i]); err != nil {
				log.Printf("publish status gagal: %v", err)
			}
		}
	}
	w.WriteHeader(http.StatusOK)
}

// --- Meta Messenger (Facebook + Instagram) ---

// handleMessenger menerima webhook Messenger/Instagram. GET = verify challenge,
// POST = verify HMAC → parse → resolve channel by (type, page/ig id) → publish inbound.
// Channel type ditentukan dari payload (object page/instagram), bukan dari path.
func (s *Server) handleMessenger(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		q := r.URL.Query()
		challenge, ok := channels.VerifyChallenge(
			s.MetaVerifyTok, q.Get("hub.mode"), q.Get("hub.verify_token"), q.Get("hub.challenge"),
		)
		if !ok {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		_, _ = w.Write([]byte(challenge))
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	if !channels.VerifySignature(s.MetaAppSecret, body, r.Header.Get("X-Hub-Signature-256")) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	parsed, err := channels.ParseMessenger(body)
	if err != nil {
		http.Error(w, "parse error", http.StatusBadRequest)
		return
	}
	for _, p := range parsed {
		cid, _, err := s.Resolver.LookupByExternal(r.Context(), p.Inbound.ChannelType, p.ExternalID)
		if err != nil {
			log.Printf("messenger webhook: %v", err)
			continue
		}
		inb := p.Inbound
		inb.ChannelId = cid
		inb.EventId = newEventID()
		inb.DedupKey = cid + ":" + inb.ProviderMessageId
		if _, err := s.Bus.PublishInbound(r.Context(), &inb); err != nil {
			log.Printf("publish inbound gagal: %v", err)
		}
	}
	w.WriteHeader(http.StatusOK)
}

// --- api.co.id (WhatsApp + Instagram + Messenger lewat satu REST gateway) ---

// handleApiCo menerima webhook api.co.id. POST saja. Verify X-Webhook-Signature
// (HMAC-SHA256 body, APICO_WEBHOOK_SECRET) → parse event → resolve channel → publish.
// message.received → message.inbound; message.{sent,delivered,read,failed} → message.status.
//
// Resolusi channel: payload tak selalu memuat id akun bisnis penerima. Bila ada
// (whatsapp_phone_number_id/page_id/ig id) → cocokkan ke channels.external_id; bila tidak,
// fallback ke channel apico tunggal untuk type tsb (satu akun api.co.id per type).
func (s *Server) handleApiCo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	if !channels.VerifyApiCoSignature(s.ApiCoSecret, body, r.Header.Get("X-Webhook-Signature")) {
		http.Error(w, "invalid signature", http.StatusUnauthorized)
		return
	}

	ev, err := channels.ParseApiCoEvent(body)
	if err != nil {
		http.Error(w, "parse error", http.StatusBadRequest)
		return
	}

	// Status receipt (sent/delivered/read/failed) → message.status. Engine match by
	// provider_message_id (= message_id api.co.id, sama dgn balikan /messages/send).
	if st, ok := channels.ApiCoStatus(ev); ok {
		if _, err := s.Bus.PublishStatus(r.Context(), &st); err != nil {
			log.Printf("apico publish status gagal: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		return
	}

	parsed, ok := channels.ParseApiCoInbound(ev)
	if !ok {
		w.WriteHeader(http.StatusOK) // event tak relevan (echo outbound dll) → abaikan
		return
	}

	cid, _, err := s.resolveApiCo(r.Context(), parsed.Inbound.ChannelType, parsed.ExternalID)
	if err != nil {
		log.Printf("apico webhook: %v", err)
		w.WriteHeader(http.StatusOK) // jangan retry tanpa henti
		return
	}
	inb := parsed.Inbound
	inb.ChannelId = cid
	inb.EventId = newEventID()
	inb.DedupKey = cid + ":" + inb.ProviderMessageId
	if _, err := s.Bus.PublishInbound(r.Context(), &inb); err != nil {
		log.Printf("apico publish inbound gagal: %v", err)
	}
	w.WriteHeader(http.StatusOK)
}

// resolveApiCo memetakan event masuk → channel_id: prefer id akun bisnis (external_id),
// fallback channel apico tunggal per type.
func (s *Server) resolveApiCo(ctx context.Context, t contracts.ChannelType, businessID string) (string, channels.ChannelInfo, error) {
	if businessID != "" {
		if cid, info, err := s.Resolver.LookupByExternal(ctx, t, businessID); err == nil {
			return cid, info, nil
		}
	}
	return s.Resolver.LookupByProvider(ctx, channels.ProviderApiCo, t)
}

// --- Telegram (channel_id di path) ---

func (s *Server) handleTelegram(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	channelID := strings.TrimPrefix(r.URL.Path, "/webhooks/telegram/")
	if channelID == "" {
		http.Error(w, "channel_id wajib", http.StatusBadRequest)
		return
	}

	// Verifikasi secret_token (X-Telegram-Bot-Api-Secret-Token) bila channel punya
	// tg_secret — cegah injeksi pesan palsu ke URL webhook. Legacy tanpa secret = lolos.
	if info, err := s.Resolver.Lookup(r.Context(), channelID); err == nil {
		if want := info.Credentials.String("tg_secret"); want != "" {
			got := r.Header.Get("X-Telegram-Bot-Api-Secret-Token")
			if subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
				http.Error(w, "invalid secret", http.StatusUnauthorized)
				return
			}
		}
	}

	var upd struct {
		Message struct {
			MessageID int64 `json:"message_id"`
			From      struct {
				ID        int64  `json:"id"`
				FirstName string `json:"first_name"`
			} `json:"from"`
			Chat struct {
				ID int64 `json:"id"`
			} `json:"chat"`
			Text string `json:"text"`
		} `json:"message"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&upd); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if upd.Message.Text == "" {
		w.WriteHeader(http.StatusOK)
		return
	}

	chatID := fmt.Sprintf("%d", upd.Message.Chat.ID)
	pmID := fmt.Sprintf("%d", upd.Message.MessageID)
	name := optStr(upd.Message.From.FirstName)
	body := upd.Message.Text
	inb := contracts.InboundMessage{
		ChannelId:         channelID,
		ChannelType:       contracts.ChannelTypeTelegram,
		EventId:           newEventID(),
		DedupKey:          channelID + ":" + pmID,
		ProviderMessageId: pmID,
		From:              contracts.Party{ExternalId: chatID, Name: name},
		Type:              contracts.InboundMessageTypeText,
		Body:              &body,
		Timestamp:         time.Now().UTC(),
	}
	if _, err := s.Bus.PublishInbound(r.Context(), &inb); err != nil {
		log.Printf("publish inbound telegram gagal: %v", err)
	}
	w.WriteHeader(http.StatusOK)
}

// --- WA unofficial onboarding (whatsmeow QR pairing) ---

// handleChannelOps: GET/POST /channels/{id}/connect-unofficial → SSE stream QR.
// Event SSE: `qr` (kode QR), `paired` (device JID — web simpan ke channel), `error`.
func (s *Server) handleChannelOps(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, "/channels/")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] != "connect-unofficial" {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	channelID := parts[0]

	if s.WA == nil {
		http.Error(w, "whatsmeow nonaktif", http.StatusServiceUnavailable)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming tidak didukung", http.StatusInternalServerError)
		return
	}

	info, err := s.Resolver.Lookup(r.Context(), channelID)
	if err != nil {
		http.Error(w, "channel tidak ditemukan", http.StatusNotFound)
		return
	}

	events, err := s.WA.PairDevice(channelID, info.TenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	for {
		select {
		case <-r.Context().Done():
			return
		case ev, open := <-events:
			if !open {
				return
			}
			switch {
			case ev.Err != nil:
				fmt.Fprintf(w, "event: error\ndata: %s\n\n", ev.Err.Error())
				flusher.Flush()
				return
			case ev.Done:
				fmt.Fprintf(w, "event: paired\ndata: %s\n\n", ev.JID)
				flusher.Flush()
				return
			case ev.QR != "":
				fmt.Fprintf(w, "event: qr\ndata: %s\n\n", ev.QR)
				flusher.Flush()
			}
		}
	}
}

func newEventID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func optStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
