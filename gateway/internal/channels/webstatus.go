package channels

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
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
		base:  strings.TrimRight(baseURL, "/"),
		token: token,
		client: &http.Client{
			Timeout: 60 * time.Second,
			// A redirect means the route is not reachable (e.g. bounced to /login);
			// surface it as an error instead of following it to a 200 page.
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
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

// MediaSink stores an inbound attachment and returns the URL the inbox renders
// (/uploads/...). Files live on the web app's upload volume, so the gateway hands
// them over through an internal endpoint instead of writing to disk itself.
type MediaSink interface {
	SaveInboundMedia(ctx context.Context, channelID string, data []byte, mime, filename string) (string, error)
}

// SaveInboundMedia calls POST {base}/api/internal/media (multipart: channel_id, file).
func (s *WebStatusSink) SaveInboundMedia(ctx context.Context, channelID string, data []byte, mime, filename string) (string, error) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if err := mw.WriteField("channel_id", channelID); err != nil {
		return "", err
	}
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename=%q`, filename))
	h.Set("Content-Type", mime)
	part, err := mw.CreatePart(h)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if err := mw.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.base+"/api/internal/media", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("X-Service-Token", s.token)
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("web media %d", resp.StatusCode)
	}
	var out struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.URL == "" {
		return "", fmt.Errorf("web media: url kosong")
	}
	return out.URL, nil
}

var _ MediaSink = (*WebStatusSink)(nil)
