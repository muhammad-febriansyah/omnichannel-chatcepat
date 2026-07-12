package channels

import (
	"testing"
	"time"

	"go.mau.fi/whatsmeow/types/events"
)

// banStatus memetakan event putus permanen whatsmeow ke enum channel_status DB.
func TestBanStatus(t *testing.T) {
	cases := []struct {
		name string
		evt  any
		want string
	}{
		{"temporary ban → banned", &events.TemporaryBan{Code: 101, Expire: time.Hour}, "banned"},
		{"logged out → disconnected", &events.LoggedOut{}, "disconnected"},
		{"connect failure → disconnected", &events.ConnectFailure{Reason: 403, Message: "banned"}, "disconnected"},
		{"client outdated → disconnected", &events.ClientOutdated{}, "disconnected"},
		{"stream replaced → disconnected", &events.StreamReplaced{}, "disconnected"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := banStatus(c.evt); got != c.want {
				t.Fatalf("banStatus(%T) = %q, mau %q", c.evt, got, c.want)
			}
		})
	}
}

// quarantineCooldown: TemporaryBan pakai durasi WA (+buffer); sisanya default.
func TestQuarantineCooldown(t *testing.T) {
	if got := quarantineCooldown(&events.TemporaryBan{Expire: 10 * time.Minute}); got != 11*time.Minute {
		t.Fatalf("temp ban cooldown = %v, mau 11m", got)
	}
	// Expire 0 → jangan pakai 0 (langsung boleh reconnect); fallback default.
	if got := quarantineCooldown(&events.TemporaryBan{Expire: 0}); got != 30*time.Minute {
		t.Fatalf("temp ban expire 0 cooldown = %v, mau 30m default", got)
	}
	if got := quarantineCooldown(&events.LoggedOut{}); got != 30*time.Minute {
		t.Fatalf("logout cooldown = %v, mau 30m default", got)
	}
}

// Semua event putus permanen wajib implement events.PermanentDisconnect — dasar
// deteksi ban di handler. Kalau library ubah ini, deteksi diam-diam mati.
func TestPermanentDisconnectMarker(t *testing.T) {
	perms := []any{
		&events.TemporaryBan{},
		&events.LoggedOut{},
		&events.ConnectFailure{},
		&events.ClientOutdated{},
		&events.StreamReplaced{},
	}
	for _, e := range perms {
		if _, ok := e.(events.PermanentDisconnect); !ok {
			t.Errorf("%T tidak lagi PermanentDisconnect — deteksi ban rusak", e)
		}
	}
	// events.Message BUKAN putus permanen — jangan sampai kena karantina.
	if _, ok := any(&events.Message{}).(events.PermanentDisconnect); ok {
		t.Error("events.Message tak boleh PermanentDisconnect")
	}
}
