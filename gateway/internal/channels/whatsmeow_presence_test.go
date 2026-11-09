package channels

import (
	"testing"

	"go.mau.fi/whatsmeow/types"
)

func TestReadTrackerMarksChatBeforeReply(t *testing.T) {
	var r readTracker
	pn := types.NewJID("6281234", types.DefaultUserServer)
	lid := types.NewJID("99887766", types.HiddenUserServer)
	r.add("c1", types.MessageInfo{ID: "m1", MessageSource: types.MessageSource{Chat: lid, Sender: lid, SenderAlt: pn}})
	r.add("c1", types.MessageInfo{ID: "m2", MessageSource: types.MessageSource{Chat: pn, Sender: pn}})
	r.add("c1", types.MessageInfo{ID: "x", MessageSource: types.MessageSource{Chat: types.NewJID("62999", types.DefaultUserServer)}})
	r.add("c2", types.MessageInfo{ID: "m3", MessageSource: types.MessageSource{Chat: pn, Sender: pn}})

	// Reply to the phone number takes both the LID- and PN-addressed messages of c1 only.
	if got := r.takeChat("c1", "6281234"); len(got) != 2 {
		t.Fatalf("takeChat = %d, want 2", len(got))
	}
	// The delayed read receipt then skips them, but other chats/channels stay pending.
	if _, ok := r.take("c1", "m1"); ok {
		t.Fatal("m1 should already be marked read")
	}
	if _, ok := r.take("c1", "x"); !ok {
		t.Fatal("other chat must stay pending")
	}
	if _, ok := r.take("c2", "m3"); !ok {
		t.Fatal("other channel must stay pending")
	}
}

func TestPresenceGenSkipsStaleOffline(t *testing.T) {
	var p presenceGen
	first := p.bump("c1")
	second := p.bump("c1")
	if p.current("c1") == first || p.current("c1") != second {
		t.Fatal("newer send must invalidate the earlier offline timer")
	}
}
