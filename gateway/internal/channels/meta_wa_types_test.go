package channels

import (
	"encoding/json"
	"testing"

	"github.com/chatcepat/gateway/internal/contracts"
)

func TestParseWhatsAppCloudButtonsAndMedia(t *testing.T) {
	body := []byte(`{"entry":[{"changes":[{"value":{
		"metadata":{"phone_number_id":"PN1"},
		"contacts":[{"wa_id":"628111","profile":{"name":"Budi"}}],
		"messages":[
		  {"from":"628111","id":"w1","timestamp":"1794030000","type":"button","context":{"id":"wamid.BC"},"button":{"text":"Mau Daftar Offline","payload":"bc:abc:0"}},
		  {"from":"628111","id":"w2","timestamp":"1794030001","type":"interactive","interactive":{"type":"list_reply","list_reply":{"id":"opt_b","title":"Hubungi agen"}}},
		  {"from":"628111","id":"w3","timestamp":"1794030002","type":"image","image":{"id":"m1","caption":"bukti transfer"}},
		  {"from":"628111","id":"w4","timestamp":"1794030003","type":"unsupported"}
		]}}]}]}`)
	got, err := ParseWhatsAppCloud(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("want 3 messages (unsupported dropped), got %d", len(got))
	}
	b := got[0].Inbound
	if b.Type != contracts.InboundMessageTypeInteractive || *b.Body != "Mau Daftar Offline" || *b.Payload != "bc:abc:0" || *b.ReplyTo != "wamid.BC" {
		t.Fatalf("button parsed wrong: %+v", b)
	}
	if b.Timestamp.Unix() != 1794030000 || *b.From.Name != "Budi" {
		t.Fatalf("timestamp/name wrong: %v %v", b.Timestamp, b.From.Name)
	}
	if l := got[1].Inbound; *l.Payload != "opt_b" || *l.Body != "Hubungi agen" {
		t.Fatalf("list reply parsed wrong: %+v", l)
	}
	if img := got[2].Inbound; img.Type != contracts.InboundMessageTypeText || *img.Body != "📷 [Gambar] bukti transfer" {
		t.Fatalf("image placeholder wrong: %+v", img)
	}
}

func TestWaMessagePayloadInteractive(t *testing.T) {
	body := "Pilih layanan"
	mk := func(n int) contracts.OutboundCommand {
		btns := contracts.OutboundCommandButtons{}
		for i := 0; i < n; i++ {
			btns = append(btns, struct {
				Id    string `json:"id" yaml:"id" mapstructure:"id"`
				Title string `json:"title" yaml:"title" mapstructure:"title"`
			}{Id: string(rune('a' + i)), Title: "Pilihan yang sangat panjang sekali"})
		}
		return contracts.OutboundCommand{Type: contracts.OutboundCommandTypeInteractive, Body: &body, Buttons: &btns}
	}
	p, err := waMessagePayload(mk(3), "628")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(p)
	var got struct {
		Interactive struct {
			Type   string `json:"type"`
			Action struct {
				Buttons []struct {
					Reply struct{ ID, Title string } `json:"reply"`
				} `json:"buttons"`
				Sections []struct {
					Rows []struct{ ID string } `json:"rows"`
				} `json:"sections"`
			} `json:"action"`
		} `json:"interactive"`
	}
	_ = json.Unmarshal(raw, &got)
	if got.Interactive.Type != "button" || len(got.Interactive.Action.Buttons) != 3 {
		t.Fatalf("3 options must be reply buttons: %s", raw)
	}
	if n := len([]rune(got.Interactive.Action.Buttons[0].Reply.Title)); n > waButtonTitleMax {
		t.Fatalf("button title not truncated (%d runes)", n)
	}
	p, _ = waMessagePayload(mk(5), "628")
	raw, _ = json.Marshal(p)
	_ = json.Unmarshal(raw, &got)
	if got.Interactive.Type != "list" || len(got.Interactive.Action.Sections[0].Rows) != 5 {
		t.Fatalf("5 options must be a list: %s", raw)
	}
	if _, err := waMessagePayload(mk(11), "628"); err == nil {
		t.Fatal("more than 10 options must fail")
	}
}
