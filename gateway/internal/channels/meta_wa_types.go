package channels

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/contracts"
)

// waCloudMessage = one entry of value.messages[] in a WA Cloud webhook.
type waCloudMessage struct {
	From      string `json:"from"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`
	Context   struct {
		ID string `json:"id"` // wamid of the message being replied to / whose button was tapped
	} `json:"context"`
	Text struct {
		Body string `json:"body"`
	} `json:"text"`
	// Quick-reply button on a template message.
	Button struct {
		Text    string `json:"text"`
		Payload string `json:"payload"`
	} `json:"button"`
	// Reply to an interactive message (reply buttons or list).
	Interactive struct {
		Type        string `json:"type"`
		ButtonReply struct {
			ID    string `json:"id"`
			Title string `json:"title"`
		} `json:"button_reply"`
		ListReply struct {
			ID    string `json:"id"`
			Title string `json:"title"`
		} `json:"list_reply"`
	} `json:"interactive"`
	Image    waMediaRef `json:"image"`
	Sticker  waMediaRef `json:"sticker"`
	Video    waMediaRef `json:"video"`
	Document waMediaRef `json:"document"`
	Location struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		Name      string  `json:"name"`
		Address   string  `json:"address"`
	} `json:"location"`
}

type waMediaRef struct {
	ID       string `json:"id"`
	Caption  string `json:"caption"`
	Filename string `json:"filename"`
}

// normalizeWaMessage maps a WA Cloud message to (type, body, payload, ok). Button taps keep
// the visible label as body (so keyword flows still match) and the id/payload separately.
// Media is not downloaded yet: it arrives as a readable placeholder plus caption instead of
// being dropped silently.
func normalizeWaMessage(m waCloudMessage) (contracts.InboundMessageType, string, string, bool) {
	withCaption := func(label, caption string) string {
		if caption != "" {
			return label + " " + caption
		}
		return label
	}
	switch m.Type {
	case "text":
		return contracts.InboundMessageTypeText, m.Text.Body, "", true
	case "button":
		return contracts.InboundMessageTypeInteractive, m.Button.Text, m.Button.Payload, true
	case "interactive":
		switch m.Interactive.Type {
		case "button_reply":
			r := m.Interactive.ButtonReply
			return contracts.InboundMessageTypeInteractive, r.Title, r.ID, true
		case "list_reply":
			r := m.Interactive.ListReply
			return contracts.InboundMessageTypeInteractive, r.Title, r.ID, true
		}
		return "", "", "", false
	case "image":
		return contracts.InboundMessageTypeText, withCaption("📷 [Gambar]", m.Image.Caption), "", true
	case "sticker":
		return contracts.InboundMessageTypeText, "[Stiker]", "", true
	case "video":
		return contracts.InboundMessageTypeText, withCaption("🎬 [Video]", m.Video.Caption), "", true
	case "audio":
		return contracts.InboundMessageTypeText, "🎤 [Pesan suara]", "", true
	case "document":
		label := "📄 [Dokumen]"
		if m.Document.Filename != "" {
			label += " " + m.Document.Filename
		}
		return contracts.InboundMessageTypeText, withCaption(label, m.Document.Caption), "", true
	case "location":
		l := m.Location
		label := fmt.Sprintf("📍 [Lokasi] https://maps.google.com/?q=%f,%f", l.Latitude, l.Longitude)
		if place := strings.TrimSpace(l.Name + " " + l.Address); place != "" {
			label += " " + place
		}
		return contracts.InboundMessageTypeText, label, "", true
	case "contacts":
		return contracts.InboundMessageTypeText, "👤 [Kontak dibagikan]", "", true
	}
	return "", "", "", false
}

// waTimestamp parses the unix-seconds timestamp Meta sends; falls back to now.
func waTimestamp(ts string) time.Time {
	if sec, err := strconv.ParseInt(ts, 10, 64); err == nil && sec > 0 {
		return time.Unix(sec, 0).UTC()
	}
	return time.Now().UTC()
}

// Interactive limits from the WA Cloud API.
const (
	waMaxReplyButtons = 3
	waMaxListRows     = 10
	waButtonTitleMax  = 20
	waListTitleMax    = 24
	waInteractiveBody = 1024
)

func truncateRunes(s string, n int) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) <= n {
		return string(r)
	}
	return string(r[:n-1]) + "…"
}

// waInteractive builds the "interactive" object: up to 3 options become reply buttons,
// 4–10 become a single-section list. Titles are truncated to Meta's limits.
func waInteractive(body string, buttons contracts.OutboundCommandButtons) (map[string]any, error) {
	if len(buttons) == 0 {
		return nil, fmt.Errorf("meta: interactive tanpa tombol")
	}
	if len(buttons) > waMaxListRows {
		return nil, fmt.Errorf("meta: maksimal %d pilihan", waMaxListRows)
	}
	if strings.TrimSpace(body) == "" {
		body = "Silakan pilih:"
	}
	bodyObj := map[string]any{"text": truncateRunes(body, waInteractiveBody)}
	if len(buttons) <= waMaxReplyButtons {
		btns := make([]map[string]any, 0, len(buttons))
		for _, b := range buttons {
			btns = append(btns, map[string]any{
				"type":  "reply",
				"reply": map[string]any{"id": b.Id, "title": truncateRunes(b.Title, waButtonTitleMax)},
			})
		}
		return map[string]any{"type": "button", "body": bodyObj, "action": map[string]any{"buttons": btns}}, nil
	}
	rows := make([]map[string]any, 0, len(buttons))
	for _, b := range buttons {
		rows = append(rows, map[string]any{"id": b.Id, "title": truncateRunes(b.Title, waListTitleMax)})
	}
	return map[string]any{
		"type": "list",
		"body": bodyObj,
		"action": map[string]any{
			"button":   "Pilih",
			"sections": []map[string]any{{"title": "Pilihan", "rows": rows}},
		},
	}, nil
}
