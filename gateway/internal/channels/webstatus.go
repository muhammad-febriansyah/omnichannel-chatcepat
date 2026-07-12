package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// ChannelStatusSink mempersist status koneksi channel secara durable. Tabel
// channels milik web (gateway TIDAK menyentuh tabel domain), jadi persist lewat
// endpoint internal web, bukan tulis DB langsung. Opsional: nil = skip persist
// (hanya realtime channel.status yang dikirim).
type ChannelStatusSink interface {
	SetChannelStatus(ctx context.Context, channelID, status, reason string) error
}

// WebStatusSink memanggil POST {base}/api/internal/channels/status (auth
// X-Service-Token) untuk set channels.status. Dipakai saat nomor WA unofficial
// banned/logout supaya badge dashboard tetap benar tanpa dashboard dibuka.
type WebStatusSink struct {
	base   string
	token  string
	client *http.Client
}

// NewWebStatusSink balikan nil bila base/token kosong (fitur persist nonaktif —
// deteksi ban tetap jalan, cuma tak persist durable).
func NewWebStatusSink(baseURL, token string) *WebStatusSink {
	if baseURL == "" || token == "" {
		return nil
	}
	return &WebStatusSink{
		base:   strings.TrimRight(baseURL, "/"),
		token:  token,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *WebStatusSink) SetChannelStatus(ctx context.Context, channelID, status, reason string) error {
	payload, err := json.Marshal(map[string]string{
		"channel_id": channelID,
		"status":     status,
		"reason":     reason,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, s.base+"/api/internal/channels/status", bytes.NewReader(payload),
	)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Token", s.token)

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("web status %d", resp.StatusCode)
	}
	return nil
}

var _ ChannelStatusSink = (*WebStatusSink)(nil)
