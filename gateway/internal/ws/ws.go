// Package ws: WebSocket server untuk dashboard. Subscribe realtime.<tenant_id>,
// push ke klien. Auth JWT short-lived. Lihat docs/prd/01, 08.
package ws

import (
	"context"
	"log"
	"net/http"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/gorilla/websocket"
)

type Handler struct {
	Bus       *bus.Bus
	JWTSecret string
	upgrader  websocket.Upgrader
}

func NewHandler(b *bus.Bus, jwtSecret string) *Handler {
	return &Handler{
		Bus:       b,
		JWTSecret: jwtSecret,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(*http.Request) bool { return true }, // TODO: batasi origin
		},
	}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	tenant := r.URL.Query().Get("tenant")
	token := r.URL.Query().Get("token")
	if tenant == "" || !h.validToken(token) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	sub := h.Bus.Subscribe(ctx, tenant)
	defer sub.Close()
	ch := sub.Channel()

	// pump: kalau klien tutup, baca akan error → cancel.
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				cancel()
				return
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, []byte(msg.Payload)); err != nil {
				return
			}
		}
	}
}

// validToken — TODO: verifikasi JWT short-lived (WS_JWT_SECRET). Sementara cek non-kosong.
func (h *Handler) validToken(token string) bool {
	if token == "" {
		return false
	}
	_ = h.JWTSecret
	log.Printf("ws: token diterima (TODO verifikasi JWT)")
	return true
}
