package channels

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

func TestIsDirectChat(t *testing.T) {
	cases := []struct {
		jid  types.JID
		want bool
	}{
		{types.NewJID("6281234567890", types.DefaultUserServer), true},
		{types.NewJID("123456789012345", types.HiddenUserServer), true},
		{types.NewJID("120363000000000000", types.GroupServer), false},
		{types.StatusBroadcastJID, false},
		{types.NewJID("120363000000000001", types.NewsletterServer), false},
	}
	for _, c := range cases {
		if got := isDirectChat(c.jid); got != c.want {
			t.Errorf("isDirectChat(%s) = %v, want %v", c.jid, got, c.want)
		}
	}
}

func TestInboundAttachment(t *testing.T) {
	if inboundAttachment(&waE2E.Message{Conversation: proto.String("halo")}) != nil {
		t.Fatal("text message must not be an attachment")
	}

	img := inboundAttachment(&waE2E.Message{ImageMessage: &waE2E.ImageMessage{Mimetype: proto.String("image/jpeg")}})
	if img == nil || !img.image || img.label != "Foto" {
		t.Fatalf("image: got %+v", img)
	}

	voice := inboundAttachment(&waE2E.Message{AudioMessage: &waE2E.AudioMessage{
		Mimetype: proto.String("audio/ogg; codecs=opus"), PTT: proto.Bool(true),
	}})
	if voice == nil || voice.image || voice.label != "Pesan suara" {
		t.Fatalf("voice note: got %+v", voice)
	}

	doc := inboundAttachment(&waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{
		Mimetype: proto.String("application/pdf"), FileName: proto.String("invoice.pdf"),
	}})
	if doc == nil || doc.filename != "invoice.pdf" {
		t.Fatalf("document: got %+v", doc)
	}
}

func TestExtractTextCaption(t *testing.T) {
	m := &waE2E.Message{ImageMessage: &waE2E.ImageMessage{Caption: proto.String("ini fotonya")}}
	if got := extractText(m); got != "ini fotonya" {
		t.Fatalf("caption = %q", got)
	}
	if got := extractText(&waE2E.Message{ImageMessage: &waE2E.ImageMessage{}}); got != "" {
		t.Fatalf("no caption = %q", got)
	}
}

func TestBaseMime(t *testing.T) {
	if got := baseMime("audio/ogg; codecs=opus"); got != "audio/ogg" {
		t.Fatalf("got %q", got)
	}
	if got := baseMime(""); got != "application/octet-stream" {
		t.Fatalf("got %q", got)
	}
}

func TestSaveInboundMedia(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/internal/media" || r.Header.Get("X-Service-Token") != "tok" {
			http.Error(w, "bad", http.StatusUnauthorized)
			return
		}
		if r.FormValue("channel_id") != "ch-1" {
			http.Error(w, "channel", http.StatusBadRequest)
			return
		}
		f, h, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "file", http.StatusBadRequest)
			return
		}
		data, _ := io.ReadAll(f)
		if string(data) != "abc" || h.Header.Get("Content-Type") != "image/jpeg" {
			http.Error(w, "content", http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`{"url":"/uploads/t/chat/x.jpg"}`))
	}))
	defer srv.Close()

	sink := NewWebStatusSink(srv.URL, "tok")
	url, err := sink.SaveInboundMedia(context.Background(), "ch-1", []byte("abc"), "image/jpeg", "whatsapp-foto")
	if err != nil {
		t.Fatal(err)
	}
	if url != "/uploads/t/chat/x.jpg" {
		t.Fatalf("url = %q", url)
	}
}

// A redirect (e.g. middleware bouncing to /login) must be an error, not a silent 200.
func TestWebSinkRedirectIsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/login" {
			_, _ = w.Write([]byte("login page"))
			return
		}
		http.Redirect(w, r, "/login", http.StatusTemporaryRedirect)
	}))
	defer srv.Close()

	sink := NewWebStatusSink(srv.URL, "tok")
	if err := sink.SetChannelStatus(context.Background(), "ch-1", "banned", "x"); err == nil {
		t.Fatal("expected error on redirect")
	}
}
