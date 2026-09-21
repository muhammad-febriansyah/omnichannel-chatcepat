package social

import (
	"errors"
	"sort"
	"strings"
	"unicode"
)

var ErrRuleNotMatched = errors.New("no active auto-reply rule matched")

// NormalizeContent is intentionally conservative: trim, lowercase, and
// collapse whitespace. It does not perform fuzzy or anti-detection logic.
func NormalizeContent(value string) string {
	return strings.Join(strings.FieldsFunc(strings.TrimSpace(strings.ToLower(value)), unicode.IsSpace), " ")
}

func MatchRule(event IncomingSocialEvent, rules []AutoReplyRule) (*AutoReplyRule, error) {
	content := NormalizeContent(event.Content)
	ordered := append([]AutoReplyRule(nil), rules...)
	sort.SliceStable(ordered, func(i, j int) bool {
		return ordered[i].Priority > ordered[j].Priority
	})
	for i := range ordered {
		rule := &ordered[i]
		if !rule.IsActive || rule.Platform != event.Platform || rule.SourceType != event.SourceType {
			continue
		}
		for _, rawKeyword := range rule.Keywords {
			keyword := NormalizeContent(rawKeyword)
			if keyword == "" {
				continue
			}
			matched := false
			switch rule.MatchType {
			case "exact":
				matched = content == keyword
			case "contains":
				matched = strings.Contains(content, keyword)
			case "starts_with":
				matched = strings.HasPrefix(content, keyword)
			}
			if matched {
				return rule, nil
			}
		}
	}
	return nil, ErrRuleNotMatched
}

func MatchesIgnoreKeyword(content string, keywords []string) bool {
	normalized := NormalizeContent(content)
	for _, keyword := range keywords {
		if normalized != "" && normalized == NormalizeContent(keyword) {
			return true
		}
	}
	return false
}

func (action AutoReplyAction) SelectedContent() string {
	for _, response := range action.Responses {
		if value := strings.TrimSpace(response); value != "" {
			return value
		}
	}
	return strings.TrimSpace(action.Content)
}
