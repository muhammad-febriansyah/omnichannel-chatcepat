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

// Provider api.co.id (https://chat.api.co.id/api/v1/public): satu gateway REST untuk
// WhatsApp + Instagram + Messenger. Dipakai sebagai pengganti integrasi Meta langsung.
// Channel type ChatCepat (wa_official/instagram/facebook) tetap, hanya transport-nya
// lewat api.co.id. Channel ditandai meta.provider = "apico" (lihat ChannelInfo.Provider).
const (
	ProviderApiCo  = "apico"
	apiCoDefaultBaseURL = "https://chat.api.co.id/api/v1/public"
)

// apiCoChannel memetakan ChannelType ChatCepat → field "channel" api.co.id.
func apiCoChannel(t contracts.ChannelType) string {
	switch t {
	case contracts.ChannelTypeInstagram:
		return "instagram"
	case contracts.ChannelTypeFacebook:
		return "messenger"
	default: // wa_official
		return "whatsapp"
	}
}

// apiCoChannelType kebalikannya: field "channel" webhook → ChannelType.
func apiCoChannelType(ch string) contracts.ChannelType {
	switch ch {
	case "instagram":
		return contracts.ChannelTypeInstagram
	case "messenger", "facebook":
		return contracts.ChannelTypeFacebook
	default: // whatsapp
		return contracts.ChannelTypeWaOfficial
	}
}

// --- Webhook security ---

// VerifyApiCoSignature memvalidasi header X-Webhook-Signature = HMAC-SHA256(body, secret)
// hex. Menerima nilai polos maupun ber-prefix "sha256=". Secret kosong → skip (dev).
func VerifyApiCoSignature(secret string, body []byte, header string) bool {
	if secret == "" {
		return true
	}
	got := strings.TrimPrefix(strings.TrimSpace(header), "sha256=")
	if got == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(got))
}

// --- Inbound parsing ---

// apiCoEvent = bentuk webhook api.co.id: { event, timestamp, data:{...} }.
type apiCoEvent struct {
	Event string `json:"event"`
	Data  struct {
		MessageID     string `json:"message_id"`
		CustomerID    string `json:"customer_id"`
		CustomerPhone string `json:"customer_phone"`
		Channel       string `json:"channel"`
		Direction     string `json:"direction"`
		MessageType   string `json:"message_type"`
		Content       string `json:"content"`
		MediaURL      string `json:"media_url"`
		Status        string `json:"status"`
		// Identitas nomor/akun bisnis penerima (opsional; tak selalu ada di payload).
		WhatsAppPhoneNumberID string `json:"whatsapp_phone_number_id"`
		PhoneNumberID         string `json:"phone_number_id"`
		InstagramAccountID    string `json:"instagram_account_id"`
		PageID                string `json:"page_id"`
	} `json:"data"`
}

// businessID mengembalikan id akun bisnis penerima bila ada (utk resolve channel by external_id).
func (e apiCoEvent) businessID() string {
	switch {
	case e.Data.WhatsAppPhoneNumberID != "":
		return e.Data.WhatsAppPhoneNumberID
	case e.Data.PhoneNumberID != "":
		return e.Data.PhoneNumberID
	case e.Data.InstagramAccountID != "":
		return e.Data.InstagramAccountID
	case e.Data.PageID != "":
		return e.Data.PageID
	}
	return ""
}

// ParseApiCoInbound menormalisasi event message.received → ParsedInbound.
// channel_id & dedup_key dilengkapi server setelah resolve channel. ok=false bila event
// ini bukan pesan masuk (mis. status receipt atau echo outbound).
func ParseApiCoInbound(e apiCoEvent) (ParsedInbound, bool) {
	if e.Event != "message.received" || e.Data.Direction == "outbound" {
		return ParsedInbound{}, false
	}
	ct := apiCoChannelType(e.Data.Channel)
	from := contracts.Party{ExternalId: e.Data.CustomerPhone}
	if e.Data.CustomerPhone == "" {
		from.ExternalId = e.Data.CustomerID
	}
	if ct == contracts.ChannelTypeWaOfficial && e.Data.CustomerPhone != "" {
		phone := "+" + strings.TrimPrefix(e.Data.CustomerPhone, "+")
		from.Phone = &phone
	}

	msgType := contracts.InboundMessageTypeText
	var media *contracts.Media
	switch e.Data.MessageType {
	case "image", "file", "video", "audio", "document":
		msgType = contracts.InboundMessageTypeImage
		if e.Data.MediaURL != "" {
			media = &contracts.Media{Url: e.Data.MediaURL}
		}
	}

	body := e.Data.Content
	inb := contracts.InboundMessage{
		ChannelType:       ct,
		ProviderMessageId: e.Data.MessageID,
		From:              from,
		Type:              msgType,
		Body:              &body,
		Timestamp:         time.Now().UTC(),
	}
	if media != nil {
		inb.Media = media
	}
	return ParsedInbound{ExternalID: e.businessID(), Inbound: inb}, true
}

// ApiCoStatus = map event status api.co.id → MessageStatusStatus. ok=false kalau bukan status.
func ApiCoStatus(e apiCoEvent) (contracts.MessageStatus, bool) {
	var st contracts.MessageStatusStatus
	switch e.Event {
	case "message.sent":
		st = contracts.MessageStatusStatusSent
	case "message.delivered":
		st = contracts.MessageStatusStatusDelivered
	case "message.read":
		st = contracts.MessageStatusStatusRead
	case "message.failed":
		st = contracts.MessageStatusStatusFailed
	default:
		return contracts.MessageStatus{}, false
	}
	out := contracts.MessageStatus{
		Status:    st,
		Timestamp: time.Now().UTC(),
	}
	if e.Data.MessageID != "" {
		id := e.Data.MessageID
		out.ProviderMessageId = &id
	}
	return out, true
}

// ParseApiCoEvent mem-unmarshal satu event webhook.
func ParseApiCoEvent(body []byte) (apiCoEvent, error) {
	var e apiCoEvent
	if err := json.Unmarshal(body, &e); err != nil {
		return apiCoEvent{}, err
	}
	return e, nil
}

// --- Outbound ---

// ApiCoSender mengirim lewat api.co.id POST /messages/send. Satu instance per ChannelType
// (whatsapp/instagram/messenger). credentials: apico_api_key (override env default),
// apico_phone_number_id (nomor WA pengirim, hanya WA). Provider() = "apico".
type ApiCoSender struct {
	channelType contracts.ChannelType
	defaultKey  string
	baseURL     string
	http        *http.Client
}

func NewApiCoSender(t contracts.ChannelType, defaultKey, baseURL string) *ApiCoSender {
	if baseURL == "" {
		baseURL = apiCoDefaultBaseURL
	}
	return &ApiCoSender{
		channelType: t,
		defaultKey:  defaultKey,
		baseURL:     strings.TrimRight(baseURL, "/"),
		http:        &http.Client{Timeout: 20 * time.Second},
	}
}

func (a *ApiCoSender) Type() contracts.ChannelType { return a.channelType }
func (a *ApiCoSender) Provider() string            { return ProviderApiCo }

func (a *ApiCoSender) Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (string, error) {
	key := creds.String("apico_api_key")
	if key == "" {
		key = a.defaultKey
	}
	if key == "" {
		return "", fmt.Errorf("apico: api key kosong (set credentials.apico_api_key atau env APICO_API_KEY)")
	}

	to := cmd.To.ExternalId
	if cmd.To.Phone != nil && *cmd.To.Phone != "" {
		to = strings.TrimPrefix(*cmd.To.Phone, "+")
	}
	if to == "" {
		return "", fmt.Errorf("apico: penerima kosong")
	}

	payload := map[string]any{
		"phone_number": to,
		"channel":      apiCoChannel(a.channelType),
	}
	if pnid := creds.String("apico_phone_number_id"); pnid != "" && a.channelType == contracts.ChannelTypeWaOfficial {
		payload["whatsapp_phone_number_id"] = pnid
	}

	switch cmd.Type {
	case contracts.OutboundCommandTypeTemplate:
		if cmd.Template == nil || cmd.Template.Name == nil || *cmd.Template.Name == "" {
			return "", fmt.Errorf("apico: template name kosong")
		}
		lang := "id"
		if cmd.Template.Lang != nil && *cmd.Template.Lang != "" {
			lang = *cmd.Template.Lang
		}
		payload["message_type"] = "template"
		payload["template_name"] = *cmd.Template.Name
		payload["language"] = lang
		if len(cmd.Template.Components) > 0 {
			payload["components"] = cmd.Template.Components
		}
	case contracts.OutboundCommandTypeMedia:
		payload["message_type"] = "image"
		if cmd.Body != nil && *cmd.Body != "" {
			payload["content"] = *cmd.Body
		}
		if m, ok := cmd.Media.(map[string]any); ok {
			if url, _ := m["url"].(string); url != "" {
				payload["media_url"] = url
			}
		}
	default:
		body := ""
		if cmd.Body != nil {
			body = *cmd.Body
		}
		payload["message_type"] = "text"
		payload["content"] = body
	}

	reqBody, _ := json.Marshal(payload)
	endpoint := a.baseURL + "/messages/send"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var out struct {
		Success bool `json:"success"`
		Data    struct {
			MessageID string `json:"message_id"`
			Status    string `json:"status"`
		} `json:"data"`
		Message string `json:"message"`
		Error   string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("apico: decode resp (status %d): %w", resp.StatusCode, err)
	}
	if resp.StatusCode >= 300 || !out.Success || out.Data.MessageID == "" {
		msg := out.Error
		if msg == "" {
			msg = out.Message
		}
		return "", fmt.Errorf("apico send gagal (status %d): %s", resp.StatusCode, msg)
	}
	return out.Data.MessageID, nil
}
