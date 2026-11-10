package channels

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/chatcepat/gateway/internal/contracts"
)

// ProfileFetcher looks up the display name of a Messenger or Instagram sender.
// DM webhooks carry only the sender id (PSID / IGSID), so without this every new
// contact shows up nameless in the inbox.
//
//	Messenger: GET /{psid}?fields=first_name,last_name   (User Profile API)
//	Instagram: GET /{igsid}?fields=name,username         (Instagram User Profile API)
//
// Both use the Page access token. Results, including misses, are cached so a busy
// conversation does not call Graph on every message.
type ProfileFetcher struct {
	base   string
	client *http.Client

	mu    sync.Mutex
	cache map[string]profileEntry
}

type profileEntry struct {
	name    string
	expires time.Time
}

const (
	profileHitTTL  = 24 * time.Hour
	profileMissTTL = time.Hour
	profileMaxKeys = 50_000
)

func NewProfileFetcher() *ProfileFetcher {
	return &ProfileFetcher{
		base:   graphBase,
		client: &http.Client{Timeout: 3 * time.Second},
		cache:  map[string]profileEntry{},
	}
}

// Name returns the sender's display name, or "" when it is unknown or the lookup fails.
// Errors are not returned: a missing name must never block an inbound message.
func (f *ProfileFetcher) Name(ctx context.Context, ct contracts.ChannelType, senderID, pageToken string) string {
	if f == nil || senderID == "" || pageToken == "" {
		return ""
	}
	var fields string
	switch ct {
	case contracts.ChannelTypeFacebook:
		fields = "first_name,last_name"
	case contracts.ChannelTypeInstagram:
		fields = "name,username"
	default:
		return ""
	}
	key := string(ct) + ":" + senderID
	now := time.Now()

	f.mu.Lock()
	if e, ok := f.cache[key]; ok && now.Before(e.expires) {
		f.mu.Unlock()
		return e.name
	}
	f.mu.Unlock()

	name := f.fetch(ctx, senderID, fields, pageToken)
	ttl := profileHitTTL
	if name == "" {
		ttl = profileMissTTL
	}

	f.mu.Lock()
	if len(f.cache) >= profileMaxKeys {
		f.cache = map[string]profileEntry{} // simple bound; entries refill on demand
	}
	f.cache[key] = profileEntry{name: name, expires: now.Add(ttl)}
	f.mu.Unlock()
	return name
}

func (f *ProfileFetcher) fetch(ctx context.Context, senderID, fields, token string) string {
	u := f.base + "/" + url.PathEscape(senderID) + "?" + url.Values{"fields": {fields}, "access_token": {token}}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return ""
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	var p struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Name      string `json:"name"`
		Username  string `json:"username"`
	}
	if json.NewDecoder(resp.Body).Decode(&p) != nil {
		return ""
	}
	if n := strings.TrimSpace(p.FirstName + " " + p.LastName); n != "" {
		return n
	}
	if n := strings.TrimSpace(p.Name); n != "" {
		return n
	}
	if u := strings.TrimSpace(p.Username); u != "" {
		return "@" + u
	}
	return ""
}
