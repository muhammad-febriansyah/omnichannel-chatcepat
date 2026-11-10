package channels

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/chatcepat/gateway/internal/contracts"
)

func TestProfileFetcherName(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Query().Get("access_token") != "page-token" {
			http.Error(w, `{"error":{}}`, http.StatusBadRequest)
			return
		}
		switch r.URL.Path {
		case "/psid-1":
			if r.URL.Query().Get("fields") != "first_name,last_name" {
				t.Errorf("messenger fields = %q", r.URL.Query().Get("fields"))
			}
			_, _ = w.Write([]byte(`{"first_name":"Budi","last_name":"Santoso","id":"psid-1"}`))
		case "/igsid-1":
			_, _ = w.Write([]byte(`{"name":"","username":"m_febrian27","id":"igsid-1"}`))
		case "/igsid-2":
			_, _ = w.Write([]byte(`{"name":"Rina","username":"rina.shop","id":"igsid-2"}`))
		default:
			http.Error(w, `{"error":{}}`, http.StatusNotFound)
		}
	}))
	defer srv.Close()

	f := NewProfileFetcher()
	f.base = srv.URL
	ctx := context.Background()

	cases := []struct {
		ct   contracts.ChannelType
		id   string
		want string
	}{
		{contracts.ChannelTypeFacebook, "psid-1", "Budi Santoso"},
		{contracts.ChannelTypeInstagram, "igsid-1", "@m_febrian27"},
		{contracts.ChannelTypeInstagram, "igsid-2", "Rina"},
		{contracts.ChannelTypeInstagram, "unknown", ""},
		{contracts.ChannelTypeTelegram, "psid-1", ""},
	}
	for _, c := range cases {
		if got := f.Name(ctx, c.ct, c.id, "page-token"); got != c.want {
			t.Errorf("Name(%s, %s) = %q, want %q", c.ct, c.id, got, c.want)
		}
	}
	if got := f.Name(ctx, contracts.ChannelTypeFacebook, "psid-1", ""); got != "" {
		t.Errorf("no token should give empty name, got %q", got)
	}

	// Hits and misses are cached: asking again makes no new requests.
	before := calls.Load()
	f.Name(ctx, contracts.ChannelTypeFacebook, "psid-1", "page-token")
	f.Name(ctx, contracts.ChannelTypeInstagram, "unknown", "page-token")
	if calls.Load() != before {
		t.Errorf("expected cached lookups, got %d new requests", calls.Load()-before)
	}

	var nilFetcher *ProfileFetcher
	if got := nilFetcher.Name(ctx, contracts.ChannelTypeFacebook, "psid-1", "page-token"); got != "" {
		t.Errorf("nil fetcher should return empty, got %q", got)
	}
}
