package channels

import (
	"context"
	"encoding/json"
	"io"
	"log"
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
//	           fallback GET /{page}/conversations?user_id={psid}&fields=participants
//	Instagram: GET /{igsid}?fields=name,username         (Instagram User Profile API)
//
// The Messenger User Profile API needs Meta's "Business Asset User Profile Access"
// feature; the conversation participants fallback works with pages_messaging alone.
// All calls use the Page access token. Results, including misses, are cached so a busy
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
func (f *ProfileFetcher) Name(ctx context.Context, ct contracts.ChannelType, pageID, senderID, pageToken string) string {
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
	if name == "" && ct == contracts.ChannelTypeFacebook && pageID != "" {
		name = f.fetchConversationName(ctx, pageID, senderID, pageToken)
	}
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

// get calls Graph and decodes a 200 response into out. Failures are logged with
// Graph's reason (never the token) and reported as false.
func (f *ProfileFetcher) get(ctx context.Context, path string, q url.Values, token string, out any) bool {
	q.Set("access_token", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.base+path+"?"+q.Encode(), nil)
	if err != nil {
		return false
	}
	resp, err := f.client.Do(req)
	if err != nil {
		log.Printf("profile lookup %s: %v", path, err)
		return false
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode != http.StatusOK {
		var e struct {
			Error struct {
				Message string `json:"message"`
				Code    int    `json:"code"`
				Subcode int    `json:"error_subcode"`
			} `json:"error"`
		}
		_ = json.Unmarshal(body, &e)
		log.Printf("profile lookup %s: HTTP %d code=%d subcode=%d %s", path, resp.StatusCode, e.Error.Code, e.Error.Subcode, e.Error.Message)
		return false
	}
	return json.Unmarshal(body, out) == nil
}

// fetchConversationName reads the sender's name from the Page's conversation with them.
func (f *ProfileFetcher) fetchConversationName(ctx context.Context, pageID, senderID, token string) string {
	var r struct {
		Data []struct {
			Participants struct {
				Data []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"data"`
			} `json:"participants"`
		} `json:"data"`
	}
	q := url.Values{"platform": {"messenger"}, "user_id": {senderID}, "fields": {"participants"}}
	if !f.get(ctx, "/"+url.PathEscape(pageID)+"/conversations", q, token, &r) {
		return ""
	}
	for _, c := range r.Data {
		for _, p := range c.Participants.Data {
			if p.ID == senderID {
				return strings.TrimSpace(p.Name)
			}
		}
	}
	return ""
}

func (f *ProfileFetcher) fetch(ctx context.Context, senderID, fields, token string) string {
	var p struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Name      string `json:"name"`
		Username  string `json:"username"`
	}
	if !f.get(ctx, "/"+url.PathEscape(senderID), url.Values{"fields": {fields}}, token, &p) {
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
