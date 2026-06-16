package channels

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/contracts"
)

// --- Webhook security (docs/prd/04, 09) ---

// VerifySignature memvalidasi header X-Hub-Signature-256 (HMAC-SHA256 body, app secret).
func VerifySignature(appSecret string, body []byte, header string) bool {
	const prefix = "sha256="
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	got := strings.TrimPrefix(header, prefix)
	return hmac.Equal([]byte(expected), []byte(got))
}

// VerifyChallenge menangani GET verifikasi webhook saat setup.
func VerifyChallenge(verifyToken, mode, token, challenge string) (string, bool) {
	if mode == "subscribe" && token == verifyToken {
		return challenge, true
	}
	return "", false
}

// --- Inbound parsing (WA Cloud) ---

// ParsedInbound = hasil normalisasi sebelum channel_id/tenant di-resolve oleh server.
type ParsedInbound struct {
	PhoneNumberID string // value.metadata.phone_number_id → cocokkan ke channels.external_id
	Inbound       contracts.InboundMessage
}

// ParseWhatsAppCloud menormalisasi payload webhook WA Cloud → daftar pesan masuk.
// channel_id & dedup_key dilengkapi server setelah resolve phone_number_id.
func ParseWhatsAppCloud(body []byte) ([]ParsedInbound, error) {
	var payload struct {
		Entry []struct {
			Changes []struct {
				Value struct {
					Metadata struct {
						PhoneNumberID string `json:"phone_number_id"`
					} `json:"metadata"`
					Contacts []struct {
						WaID    string `json:"wa_id"`
						Profile struct {
							Name string `json:"name"`
						} `json:"profile"`
					} `json:"contacts"`
					Messages []struct {
						From      string `json:"from"`
						ID        string `json:"id"`
						Timestamp string `json:"timestamp"`
						Type      string `json:"type"`
						Text      struct {
							Body string `json:"body"`
						} `json:"text"`
					} `json:"messages"`
				} `json:"value"`
			} `json:"changes"`
		} `json:"entry"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	var out []ParsedInbound
	for _, e := range payload.Entry {
		for _, c := range e.Changes {
			v := c.Value
			name := ""
			if len(v.Contacts) > 0 {
				name = v.Contacts[0].Profile.Name
			}
			for _, m := range v.Messages {
				if m.Type != "text" {
					continue // TODO: image/file/interactive
				}
				phone := "+" + m.From
				bodyText := m.Text.Body
				namePtr := optStr(name)
				inb := contracts.InboundMessage{
					ChannelType:       contracts.ChannelTypeWaOfficial,
					ProviderMessageId: m.ID,
					From: contracts.Party{
						ExternalId: m.From,
						Phone:      &phone,
						Name:       namePtr,
					},
					Type:      contracts.InboundMessageTypeText,
					Body:      &bodyText,
					Timestamp: time.Now().UTC(),
				}
				out = append(out, ParsedInbound{PhoneNumberID: v.Metadata.PhoneNumberID, Inbound: inb})
			}
		}
	}
	return out, nil
}

func optStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// --- Outbound (Graph API) ---

// MetaSender mengirim lewat WA Cloud Graph API. credentials: phone_number_id, access_token.
type MetaSender struct {
	http *http.Client
}

func NewMetaSender() *MetaSender {
	return &MetaSender{http: &http.Client{Timeout: 15 * time.Second}}
}

func (m *MetaSender) Type() contracts.ChannelType { return contracts.ChannelTypeWaOfficial }

func (m *MetaSender) Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (string, error) {
	phoneNumberID := creds.String("phone_number_id")
	token := creds.String("access_token")
	if phoneNumberID == "" || token == "" {
		return "", fmt.Errorf("meta: phone_number_id/access_token kosong")
	}
	body := ""
	if cmd.Body != nil {
		body = *cmd.Body
	}
	to := cmd.To.ExternalId
	if cmd.To.Phone != nil {
		to = strings.TrimPrefix(*cmd.To.Phone, "+")
	}
	reqBody, _ := json.Marshal(map[string]any{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "text",
		"text":              map[string]any{"body": body},
	})
	endpoint := fmt.Sprintf("https://graph.facebook.com/v20.0/%s/messages", phoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var out struct {
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 || len(out.Messages) == 0 {
		return "", fmt.Errorf("meta send gagal: %s", out.Error.Message)
	}
	return out.Messages[0].ID, nil
}
