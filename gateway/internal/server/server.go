// Package server: HTTP publik gateway — webhook receiver + WS. Lihat docs/prd/09.
package server

import (
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
	MetaAppSecret string
	MetaVerifyTok string
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/webhooks/meta/wa", s.handleMetaWA)
	mux.HandleFunc("/webhooks/telegram/", s.handleTelegram) // /webhooks/telegram/{channel_id}
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
	w.WriteHeader(http.StatusOK)
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

// --- WA unofficial onboarding (stub) ---

func (s *Server) handleChannelOps(w http.ResponseWriter, _ *http.Request) {
	// TODO(04): connect-unofficial → mulai sesi whatsmeow → balikan QR; /qr SSE sampai paired.
	http.Error(w, "whatsmeow belum diimplementasi", http.StatusNotImplemented)
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
