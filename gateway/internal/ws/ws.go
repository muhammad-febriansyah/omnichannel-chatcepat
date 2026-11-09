// Package ws: WebSocket server untuk dashboard. Subscribe realtime.<tenant_id>,
// push ke klien. Auth JWT short-lived. Lihat docs/prd/01, 08.
package ws

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

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
	if tenant == "" || !h.validToken(tenant, token, time.Now()) {
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

// validToken checks the web-issued token "<tenant>.<exp>.<hex hmac-sha256>" (see
// web/lib/realtime-token.ts): signed with JWTSecret, bound to this tenant, not expired.
func (h *Handler) validToken(tenant, token string, now time.Time) bool {
	if h.JWTSecret == "" {
		log.Printf("ws: WS_JWT_SECRET kosong — koneksi ditolak")
		return false
	}
	i := strings.LastIndex(token, ".")
	if i <= 0 {
		return false
	}
	payload, sig := token[:i], token[i+1:]
	j := strings.LastIndex(payload, ".")
	if j <= 0 || payload[:j] != tenant {
		return false
	}
	exp, err := strconv.ParseInt(payload[j+1:], 10, 64)
	if err != nil || now.Unix() > exp {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.JWTSecret))
	mac.Write([]byte(payload))
	want := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(sig), []byte(want))
}
