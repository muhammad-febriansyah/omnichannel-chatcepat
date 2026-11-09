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
					Messages []waCloudMessage `json:"messages"`
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
			names := map[string]string{}
			for _, ct := range v.Contacts {
				names[ct.WaID] = ct.Profile.Name
			}
			for _, m := range v.Messages {
				typ, bodyText, payloadStr, ok := normalizeWaMessage(m)
				if !ok {
					continue // unsupported / system message
				}
				phone := "+" + m.From
				name := names[m.From]
				if name == "" && len(v.Contacts) == 1 {
					name = v.Contacts[0].Profile.Name
				}
				inb := contracts.InboundMessage{
					ChannelType:       contracts.ChannelTypeWaOfficial,
					ProviderMessageId: m.ID,
					From: contracts.Party{
						ExternalId: m.From,
						Phone:      &phone,
						Name:       optStr(name),
					},
					Type:      typ,
					Body:      optStr(bodyText),
					Payload:   contracts.InboundMessagePayload(optStr(payloadStr)),
					ReplyTo:   contracts.InboundMessageReplyTo(optStr(m.Context.ID)),
					Timestamp: waTimestamp(m.Timestamp),
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
				Sender struct {
					ID string `json:"id"`
				} `json:"sender"`
				Timestamp int64 `json:"timestamp"`
				Message   struct {
					Mid    string `json:"mid"`
					Text   string `json:"text"`
					IsEcho bool   `json:"is_echo"`
				} `json:"message"`
			} `json:"messaging"`
			Changes []metaChange `json:"changes"`
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
		for _, ch := range e.Changes {
			if inb, ok := commentInbound(ct, e.ID, ch); ok {
				out = append(out, ParsedInbound{ExternalID: e.ID, Inbound: inb})
			}
		}
	}
	return out, nil
}

// metaChange = entry.changes[] (Page "feed" / Instagram "comments").
type metaChange struct {
	Field string `json:"field"`
	Value struct {
		// Facebook feed
		Item      string `json:"item"`
		Verb      string `json:"verb"`
		CommentID string `json:"comment_id"`
		PostID    string `json:"post_id"`
		ParentID  string `json:"parent_id"`
		Message   string `json:"message"`
		// Instagram comments
		ID    string `json:"id"`
		Text  string `json:"text"`
		Media struct {
			ID string `json:"id"`
		} `json:"media"`
		// Both
		From struct {
			ID       string `json:"id"`
			Name     string `json:"name"`
			Username string `json:"username"`
		} `json:"from"`
	} `json:"value"`
}

// commentInbound normalises a new comment on our Page/IG post. Our own replies
// (from.id == account id), edits, deletions and non-comment feed items are skipped.
func commentInbound(ct contracts.ChannelType, accountID string, ch metaChange) (contracts.InboundMessage, bool) {
	v := ch.Value
	var commentID, postID, parentID, text string
	switch {
	case ch.Field == "feed" && v.Item == "comment" && v.Verb == "add":
		commentID, postID, parentID, text = v.CommentID, v.PostID, v.ParentID, v.Message
		// FB sets parent_id = post_id for top-level comments.
		if parentID == postID {
			parentID = ""
		}
	case ch.Field == "comments":
		commentID, postID, parentID, text = v.ID, v.Media.ID, v.ParentID, v.Text
	default:
		return contracts.InboundMessage{}, false
	}
	if commentID == "" || postID == "" || strings.TrimSpace(text) == "" || v.From.ID == "" || v.From.ID == accountID {
		return contracts.InboundMessage{}, false
	}
	name := v.From.Name
	if name == "" {
		name = v.From.Username
	}
	comment := contracts.SocialComment{CommentId: commentID, PostId: postID}
	if parentID != "" {
		p := parentID
		comment.ParentId = &p
	}
	from := contracts.Party{ExternalId: v.From.ID}
	if name != "" {
		from.Name = &name
	}
	return contracts.InboundMessage{
		ChannelType:       ct,
		ProviderMessageId: commentID,
		From:              from,
		Type:              contracts.InboundMessageTypeText,
		Body:              &text,
		Comment:           &comment,
		Timestamp:         time.Now().UTC(),
	}, true
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
	switch {
	case cmd.Type == contracts.OutboundCommandTypeInteractive && cmd.Buttons != nil && len(*cmd.Buttons) > 0:
		inter, err := waInteractive(body, *cmd.Buttons)
		if err != nil {
			return nil, err
		}
		payload["type"] = "interactive"
		payload["interactive"] = inter
	case cmd.Type == contracts.OutboundCommandTypeMedia && outboundMedia(cmd) != nil:
		media := outboundMedia(cmd)
		kind := waMediaKind(media.Mime)
		obj := map[string]any{"link": media.Url}
		if body != "" && kind != "audio" {
			obj["caption"] = body
		}
		if kind == "document" && media.Filename != nil && *media.Filename != "" {
			obj["filename"] = *media.Filename
		}
		payload["type"] = kind
		payload[kind] = obj
	default:
		payload["type"] = "text"
		payload["text"] = map[string]any{"body": body}
	}
	return payload, nil
}

// outboundMedia decodes the loosely-typed media field (oneOf Media|null) of a command.
func outboundMedia(cmd contracts.OutboundCommand) *contracts.Media {
	if cmd.Media == nil {
		return nil
	}
	raw, err := json.Marshal(cmd.Media)
	if err != nil {
		return nil
	}
	var m contracts.Media
	if json.Unmarshal(raw, &m) != nil || m.Url == "" {
		return nil
	}
	return &m
}

// waMediaKind maps a MIME type to the WA Cloud media message type.
func waMediaKind(mime string) string {
	switch {
	case strings.HasPrefix(mime, "image/"):
		return "image"
	case strings.HasPrefix(mime, "video/"):
		return "video"
	case strings.HasPrefix(mime, "audio/"):
		return "audio"
	case mime == "":
		return "image"
	}
	return "document"
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
	media := outboundMedia(cmd)
	if body == "" && media == nil {
		return "", fmt.Errorf("messenger: body kosong")
	}
	commentID := ""
	if cmd.CommentId != nil {
		commentID = *cmd.CommentId
	}
	humanize := cmd.Humanize != nil && *cmd.Humanize
	if cmd.ReplyMode != nil && *cmd.ReplyMode == contracts.OutboundCommandReplyModeCommentReply {
		if commentID == "" {
			return "", fmt.Errorf("messenger: comment_id kosong")
		}
		// Public reply: a person reads the comment, then types — never instant.
		if humanize && !humanPause(ctx, readDelay()+typingDelay(len(body))) {
			return "", ctx.Err()
		}
		return m.replyComment(ctx, commentID, body, token)
	}
	recipient := map[string]any{"id": cmd.To.ExternalId}
	if cmd.ReplyMode != nil && *cmd.ReplyMode == contracts.OutboundCommandReplyModePrivateReply {
		// Private reply: one DM to the commenter, allowed once per comment (7 days).
		if commentID == "" {
			return "", fmt.Errorf("messenger: comment_id kosong")
		}
		recipient = map[string]any{"comment_id": commentID}
		// No conversation exists yet, so no seen/typing indicator — only the pause.
		if humanize && !humanPause(ctx, readDelay()+typingDelay(len(body))) {
			return "", ctx.Err()
		}
	} else if humanize && !m.actLikeHuman(ctx, pageID, token, recipient, len(body)) {
		return "", ctx.Err()
	}

	// Attachment first (Messenger/IG attachments have no caption), then the text.
	firstID := ""
	if media != nil {
		id, err := m.post(ctx, pageID, token, recipient, map[string]any{
			"attachment": map[string]any{
				"type":    messengerAttachmentType(media.Mime),
				"payload": map[string]any{"url": media.Url, "is_reusable": true},
			},
		})
		if err != nil {
			return "", err
		}
		firstID = id
	}
	if body != "" {
		id, err := m.post(ctx, pageID, token, recipient, map[string]any{"text": body})
		if err != nil {
			return "", err
		}
		if firstID == "" {
			firstID = id
		}
	}
	return firstID, nil
}

// humanPause sleeps for d unless ctx ends first (false). A variable so tests run
// without real waiting.
var humanPause = sleepCtx

// actLikeHuman shows the bot reply the way a person answers in Messenger / Instagram
// DM: mark the message seen, pause to "read", show typing for a time that fits the
// reply length, then the caller sends. Indicator errors are ignored (best-effort);
// false only when ctx ends.
func (m *MessengerSender) actLikeHuman(ctx context.Context, pageID, token string, recipient map[string]any, bodyLen int) bool {
	m.senderAction(ctx, pageID, token, recipient, "mark_seen")
	if !humanPause(ctx, readDelay()) {
		return false
	}
	m.senderAction(ctx, pageID, token, recipient, "typing_on")
	return humanPause(ctx, typingDelay(bodyLen))
}

// senderAction posts a sender_action (mark_seen / typing_on) to the Send API.
func (m *MessengerSender) senderAction(ctx context.Context, pageID, token string, recipient map[string]any, action string) {
	reqBody, _ := json.Marshal(map[string]any{"recipient": recipient, "sender_action": action})
	endpoint := fmt.Sprintf("https://graph.facebook.com/v20.0/%s/messages", pageID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := m.http.Do(req)
	if err != nil {
		return
	}
	resp.Body.Close()
}

// messengerAttachmentType maps a MIME type to Messenger/Instagram attachment types.
func messengerAttachmentType(mime string) string {
	switch {
	case strings.HasPrefix(mime, "image/"):
		return "image"
	case strings.HasPrefix(mime, "video/"):
		return "video"
	case strings.HasPrefix(mime, "audio/"):
		return "audio"
	}
	return "file"
}

func (m *MessengerSender) post(ctx context.Context, pageID, token string, recipient map[string]any, message map[string]any) (string, error) {
	reqBody, _ := json.Marshal(map[string]any{
		"recipient":      recipient,
		"messaging_type": "RESPONSE",
		"message":        message,
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

// replyComment posts a public reply under a comment. Facebook: /{comment-id}/comments,
// Instagram: /{ig-comment-id}/replies (both with the Page access token).
func (m *MessengerSender) replyComment(ctx context.Context, commentID, body, token string) (string, error) {
	edge := "comments"
	if m.channelType == contracts.ChannelTypeInstagram {
		edge = "replies"
	}
	reqBody, _ := json.Marshal(map[string]any{"message": body})
	endpoint := fmt.Sprintf("https://graph.facebook.com/v20.0/%s/%s", commentID, edge)
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
		ID    string `json:"id"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 || out.ID == "" {
		return "", fmt.Errorf("balas komentar gagal: %s", out.Error.Message)
	}
	return out.ID, nil
}
