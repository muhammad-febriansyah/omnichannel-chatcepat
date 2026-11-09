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
