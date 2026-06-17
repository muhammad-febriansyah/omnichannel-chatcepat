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
	ExternalID    string // id akun (phone_number_id / page_id / ig_id) → channels.external_id
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

// ParseWhatsAppStatuses menormalisasi value.statuses[] (delivery/read receipt) WA Cloud
// → []MessageStatus. IdempotencyKey kosong (webhook tak tahu) → engine match by
// provider_message_id (wamid). Status: sent/delivered/read/failed.
func ParseWhatsAppStatuses(body []byte) ([]contracts.MessageStatus, error) {
	var payload struct {
		Entry []struct {
			Changes []struct {
				Value struct {
					Statuses []struct {
						ID     string `json:"id"`
						Status string `json:"status"`
						Errors []struct {
							Title string `json:"title"`
						} `json:"errors"`
					} `json:"statuses"`
				} `json:"value"`
			} `json:"changes"`
		} `json:"entry"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	var out []contracts.MessageStatus
	for _, e := range payload.Entry {
		for _, c := range e.Changes {
			for _, s := range c.Value.Statuses {
				st := contracts.MessageStatus{
					ProviderMessageId: optStr(s.ID),
					Status:            contracts.MessageStatusStatus(s.Status),
					Timestamp:         time.Now().UTC(),
				}
				if len(s.Errors) > 0 {
					st.Error = optStr(s.Errors[0].Title)
				}
				out = append(out, st)
			}
		}
	}
	return out, nil
}

// --- Inbound parsing (Messenger Platform: Facebook + Instagram) ---

// ParseMessenger menormalisasi webhook Messenger/Instagram → daftar pesan masuk.
// object "page" → facebook, "instagram" → instagram. ExternalID = entry.id (page/ig id),
// dicocokkan ke channels.external_id. Lewati echo (pesan keluar kita sendiri) & non-teks.
func ParseMessenger(body []byte) ([]ParsedInbound, error) {
	var payload struct {
		Object string `json:"object"`
		Entry  []struct {
			ID        string `json:"id"`
			Messaging []struct {
				Sender    struct {
					ID string `json:"id"`
				} `json:"sender"`
				Timestamp int64 `json:"timestamp"`
				Message   struct {
					Mid    string `json:"mid"`
					Text   string `json:"text"`
					IsEcho bool   `json:"is_echo"`
				} `json:"message"`
			} `json:"messaging"`
		} `json:"entry"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	ct := contracts.ChannelTypeFacebook
	if payload.Object == "instagram" {
		ct = contracts.ChannelTypeInstagram
	}

	var out []ParsedInbound
	for _, e := range payload.Entry {
		for _, msg := range e.Messaging {
			if msg.Message.IsEcho || msg.Message.Text == "" {
				continue // echo / delivery / read / non-teks → lewati
			}
			text := msg.Message.Text
			ts := time.Now().UTC()
			if msg.Timestamp > 0 {
				ts = time.UnixMilli(msg.Timestamp).UTC()
			}
			inb := contracts.InboundMessage{
				ChannelType:       ct,
				ProviderMessageId: msg.Message.Mid,
				From:              contracts.Party{ExternalId: msg.Sender.ID},
				Type:              contracts.InboundMessageTypeText,
				Body:              &text,
				Timestamp:         ts,
			}
			out = append(out, ParsedInbound{ExternalID: e.ID, Inbound: inb})
		}
	}
	return out, nil
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

// waMessagePayload membangun body WA Cloud /messages: text (dalam window) atau
// template HSM (luar window 24 jam). template: {name, language.code, components?}.
func waMessagePayload(cmd contracts.OutboundCommand, to string) (map[string]any, error) {
	payload := map[string]any{"messaging_product": "whatsapp", "to": to}
	if cmd.Type == contracts.OutboundCommandTypeTemplate {
		if cmd.Template == nil || cmd.Template.Name == nil || *cmd.Template.Name == "" {
			return nil, fmt.Errorf("meta: template name kosong")
		}
		lang := "id"
		if cmd.Template.Lang != nil && *cmd.Template.Lang != "" {
			lang = *cmd.Template.Lang
		}
		tmpl := map[string]any{
			"name":     *cmd.Template.Name,
			"language": map[string]any{"code": lang},
		}
		if len(cmd.Template.Components) > 0 {
			tmpl["components"] = cmd.Template.Components
		}
		payload["type"] = "template"
		payload["template"] = tmpl
		return payload, nil
	}
	body := ""
	if cmd.Body != nil {
		body = *cmd.Body
	}
	payload["type"] = "text"
	payload["text"] = map[string]any{"body": body}
	return payload, nil
}

func (m *MetaSender) Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (string, error) {
	phoneNumberID := creds.String("phone_number_id")
	token := creds.String("access_token")
	if phoneNumberID == "" || token == "" {
		return "", fmt.Errorf("meta: phone_number_id/access_token kosong")
	}
	to := cmd.To.ExternalId
	if cmd.To.Phone != nil {
		to = strings.TrimPrefix(*cmd.To.Phone, "+")
	}

	payload, err := waMessagePayload(cmd, to)
	if err != nil {
		return "", err
	}
	reqBody, _ := json.Marshal(payload)
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

// MessengerSender mengirim lewat Messenger Platform Send API (Facebook + Instagram).
// Endpoint sama untuk keduanya: POST /{page_id|ig_id}/messages, recipient.id = PSID/IGSID.
// credentials: page_id (= external_id), access_token (page access token).
type MessengerSender struct {
	channelType contracts.ChannelType
	http        *http.Client
}

func NewMessengerSender(t contracts.ChannelType) *MessengerSender {
	return &MessengerSender{channelType: t, http: &http.Client{Timeout: 15 * time.Second}}
}

func (m *MessengerSender) Type() contracts.ChannelType { return m.channelType }

func (m *MessengerSender) Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (string, error) {
	pageID := creds.String("page_id")
	token := creds.String("access_token")
	if pageID == "" || token == "" {
		return "", fmt.Errorf("messenger: page_id/access_token kosong")
	}
	body := ""
	if cmd.Body != nil {
		body = *cmd.Body
	}
	if body == "" {
		return "", fmt.Errorf("messenger: body kosong")
	}
	reqBody, _ := json.Marshal(map[string]any{
		"recipient":      map[string]any{"id": cmd.To.ExternalId},
		"messaging_type": "RESPONSE",
		"message":        map[string]any{"text": body},
	})
	endpoint := fmt.Sprintf("https://graph.facebook.com/v20.0/%s/messages", pageID)
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
		MessageID string `json:"message_id"`
		Error     struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 || out.MessageID == "" {
		return "", fmt.Errorf("messenger send gagal: %s", out.Error.Message)
	}
	return out.MessageID, nil
}
