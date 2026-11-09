package channels

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/chatcepat/gateway/internal/contracts"
)

// recordingTransport answers every Graph call with success and remembers what was sent.
type recordingTransport struct {
	mu    sync.Mutex
	calls []string // "sender_action:<x>", "message", "comment"
}

func (r *recordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	raw, _ := io.ReadAll(req.Body)
	var body map[string]any
	_ = json.Unmarshal(raw, &body)
	kind := "message"
	switch {
	case body["sender_action"] != nil:
		kind = "sender_action:" + body["sender_action"].(string)
	case strings.HasSuffix(req.URL.Path, "/comments") || strings.HasSuffix(req.URL.Path, "/replies"):
		kind = "comment"
	}
	r.mu.Lock()
	r.calls = append(r.calls, kind)
	r.mu.Unlock()
	resp := `{"message_id":"m1","id":"c1"}`
	return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(resp)), Header: http.Header{}}, nil
}

func newTestMessenger(t *testing.T, ct contracts.ChannelType) (*MessengerSender, *recordingTransport, *[]time.Duration) {
	t.Helper()
	rec := &recordingTransport{}
	var pauses []time.Duration
	orig := humanPause
	humanPause = func(_ context.Context, d time.Duration) bool {
		pauses = append(pauses, d)
		return true
	}
	t.Cleanup(func() { humanPause = orig })
	return &MessengerSender{channelType: ct, http: &http.Client{Transport: rec}}, rec, &pauses
}

var testCreds = Credentials{"page_id": "p1", "access_token": "tok"}

func TestMessengerHumanizedDM(t *testing.T) {
	m, rec, pauses := newTestMessenger(t, contracts.ChannelTypeInstagram)
	yes := true
	body := "Halo kak, stoknya masih ada ya 😊"
	_, err := m.Send(context.Background(), contracts.OutboundCommand{
		To: contracts.Party{ExternalId: "u1"}, Body: &body, Humanize: &yes,
	}, testCreds)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"sender_action:mark_seen", "sender_action:typing_on", "message"}
	if strings.Join(rec.calls, ",") != strings.Join(want, ",") {
		t.Fatalf("calls = %v, want %v", rec.calls, want)
	}
	if len(*pauses) != 2 {
		t.Fatalf("pauses = %v", *pauses)
	}
}

func TestMessengerAgentReplyIsImmediate(t *testing.T) {
	m, rec, pauses := newTestMessenger(t, contracts.ChannelTypeFacebook)
	body := "Siap kak"
	if _, err := m.Send(context.Background(), contracts.OutboundCommand{
		To: contracts.Party{ExternalId: "u1"}, Body: &body,
	}, testCreds); err != nil {
		t.Fatal(err)
	}
	if strings.Join(rec.calls, ",") != "message" || len(*pauses) != 0 {
		t.Fatalf("agent reply should send at once: calls=%v pauses=%v", rec.calls, *pauses)
	}
}

func TestMessengerHumanizedCommentReply(t *testing.T) {
	m, rec, pauses := newTestMessenger(t, contracts.ChannelTypeInstagram)
	yes := true
	body := "Sudah kami DM ya kak"
	cid := "17890"
	mode := contracts.OutboundCommandReplyModeCommentReply
	if _, err := m.Send(context.Background(), contracts.OutboundCommand{
		To: contracts.Party{ExternalId: "u1"}, Body: &body, Humanize: &yes, CommentId: &cid, ReplyMode: &mode,
	}, testCreds); err != nil {
		t.Fatal(err)
	}
	if strings.Join(rec.calls, ",") != "comment" || len(*pauses) != 1 || (*pauses)[0] < time.Second {
		t.Fatalf("comment reply: calls=%v pauses=%v", rec.calls, *pauses)
	}
}

// Meta's dashboard "Test" sends the timestamp as a string; real webhooks send a number.
// Both must parse (an error reply makes Meta retry and eventually disable the webhook).
func TestParseMessengerTimestampStringOrNumber(t *testing.T) {
	for _, ts := range []string{`"1527459824000"`, `1527459824000`, `"oops"`} {
		body := []byte(`{"object":"page","entry":[{"id":"p1","messaging":[{"sender":{"id":"u1"},"timestamp":` + ts + `,"message":{"mid":"m1","text":"halo"}}]}]}`)
		parsed, err := ParseMessenger(body)
		if err != nil {
			t.Fatalf("timestamp %s: %v", ts, err)
		}
		if len(parsed) != 1 || parsed[0].ExternalID != "p1" || *parsed[0].Inbound.Body != "halo" {
			t.Fatalf("timestamp %s: got %+v", ts, parsed)
		}
	}
}

// Instagram can deliver a DM as entry.changes[] with value.message as an object.
// That shape used to fail the whole payload ("cannot unmarshal object ... of type string").
func TestParseMessengerChangesMessageObject(t *testing.T) {
	body := []byte(`{"object":"instagram","entry":[{"id":"ig1","time":1,"changes":[
		{"field":"messages","value":{"sender":{"id":"u9"},"recipient":{"id":"ig1"},"timestamp":"1762670000",
		 "message":{"mid":"m-77","text":"halo kak"}}},
		{"field":"comments","value":{"id":"c1","text":"info dong","media":{"id":"p1"},"from":{"id":"u2","username":"budi"}}}
	]}]}`)
	parsed, err := ParseMessenger(body)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(parsed) != 2 {
		t.Fatalf("got %d inbound, want DM + comment", len(parsed))
	}
	dm := parsed[0].Inbound
	if dm.ProviderMessageId != "m-77" || *dm.Body != "halo kak" || dm.From.ExternalId != "u9" || dm.Comment != nil {
		t.Fatalf("dm = %+v", dm)
	}
	if parsed[1].Inbound.Comment == nil || *parsed[1].Inbound.Body != "info dong" {
		t.Fatalf("comment = %+v", parsed[1].Inbound)
	}

	// Facebook feed comment still reads value.message as text.
	fb := []byte(`{"object":"page","entry":[{"id":"p1","changes":[{"field":"feed","value":{"item":"comment","verb":"add","comment_id":"c9","post_id":"p1_5","parent_id":"p1_5","message":"mau dong","from":{"id":"u3","name":"Ani"}}}]}]}`)
	got, err := ParseMessenger(fb)
	if err != nil || len(got) != 1 || *got[0].Inbound.Body != "mau dong" {
		t.Fatalf("fb comment: %v %+v", err, got)
	}
}
