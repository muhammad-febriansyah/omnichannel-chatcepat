package social

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// CanonicalPostURL strips comment/tracking parameters, retaining Facebook's
// query-based post identity. Never merge two different posts into one key.
func CanonicalPostURL(platform, raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" {
		return "", ErrInvalidTargetURL
	}
	host := strings.ToLower(u.Hostname())
	path := strings.TrimRight(u.Path, "/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	q := url.Values{}
	switch platform {
	case PlatformInstagram:
		if host != "instagram.com" && host != "www.instagram.com" {
			return "", ErrInvalidTargetURL
		}
		if len(parts) != 2 || (parts[0] != "p" && parts[0] != "reel" && parts[0] != "tv") {
			return "", ErrInvalidTargetURL
		}
		u.Host = "www.instagram.com"
	case PlatformFacebook:
		if host != "facebook.com" && host != "www.facebook.com" && host != "m.facebook.com" {
			return "", ErrInvalidTargetURL
		}
		valid := false
		for i, part := range parts {
			if (part == "posts" || part == "permalink" || part == "photos" || part == "reel" || part == "videos") && i+1 < len(parts) {
				valid = true
			}
		}
		if path == "/permalink.php" || path == "/story.php" {
			if u.Query().Get("story_fbid") != "" && u.Query().Get("id") != "" {
				valid = true
				q.Set("story_fbid", u.Query().Get("story_fbid"))
				q.Set("id", u.Query().Get("id"))
			}
		}
		if !valid {
			return "", ErrInvalidTargetURL
		}
		u.Host = "www.facebook.com"
	default:
		return "", ErrUnsupportedPlatform
	}
	u.Path, u.RawPath, u.RawQuery, u.Fragment, u.RawFragment = path, "", q.Encode(), "", ""
	return u.String(), nil
}

func NormalizeCommentPostURLs(platform string, urls []string) ([]string, error) {
	if len(urls) > 50 {
		return nil, fmt.Errorf("maximum 50 monitored posts per account: %w", ErrInvalidTargetURL)
	}
	result := make([]string, 0, len(urls))
	seen := map[string]bool{}
	for _, raw := range urls {
		post, err := CanonicalPostURL(platform, raw)
		if err != nil {
			return nil, err
		}
		if !seen[post] {
			result = append(result, post)
			seen[post] = true
		}
	}
	return result, nil
}

func CommentActionKey(event IncomingSocialEvent, action string) string {
	if event.SourceType != EventSourceComment || event.AuthorExternalID == "" || event.TargetURL == nil {
		return ""
	}
	post, err := CanonicalPostURL(event.Platform, *event.TargetURL)
	if err != nil {
		return ""
	}
	data, _ := json.Marshal([]string{event.Platform, event.AccountID, post, event.AuthorExternalID, action})
	return fmt.Sprintf("%x", sha256.Sum256(data))
}
