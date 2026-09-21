package social

import (
	"errors"
	"testing"
)

func TestNormalizeContent(t *testing.T) {
	if got := NormalizeContent("  Saya\tMAU   INFO  "); got != "saya mau info" {
		t.Fatalf("normalized content = %q", got)
	}
}

func TestMatchRuleByTypeAndPriorityOrder(t *testing.T) {
	event := IncomingSocialEvent{Platform: PlatformInstagram, SourceType: EventSourceComment, Content: "Saya mau info"}
	rules := []AutoReplyRule{
		{ID: "lower-priority", Platform: PlatformInstagram, SourceType: EventSourceComment, MatchType: "contains", IsActive: true, Priority: 1, Keywords: []string{"mau"}},
		{ID: "higher-priority", Platform: PlatformInstagram, SourceType: EventSourceComment, MatchType: "contains", IsActive: true, Priority: 10, Keywords: []string{"info"}},
		{ID: "disabled", Platform: PlatformInstagram, SourceType: EventSourceComment, MatchType: "contains", IsActive: false, Keywords: []string{"info"}},
	}
	matched, err := MatchRule(event, rules)
	if err != nil || matched.ID != "higher-priority" {
		t.Fatalf("matched=%+v err=%v", matched, err)
	}
}

func TestMatchRuleExactAndStartsWith(t *testing.T) {
	for _, tt := range []struct {
		name      string
		matchType string
		content   string
		want      bool
	}{
		{name: "exact", matchType: "exact", content: "Mau", want: true},
		{name: "exact extra text", matchType: "exact", content: "Mau info", want: false},
		{name: "starts with", matchType: "starts_with", content: "Mau kak", want: true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := MatchRule(
				IncomingSocialEvent{Platform: PlatformFacebook, SourceType: EventSourceMessage, Content: tt.content},
				[]AutoReplyRule{{Platform: PlatformFacebook, SourceType: EventSourceMessage, MatchType: tt.matchType, IsActive: true, Keywords: []string{"mau"}}},
			)
			if (err == nil) != tt.want {
				t.Fatalf("err=%v wantMatch=%v", err, tt.want)
			}
		})
	}
}

func TestIgnoreKeywordAndResponseSelection(t *testing.T) {
	if !MatchesIgnoreKeyword("  STOP ", []string{"stop", "human"}) {
		t.Fatal("expected ignore keyword match")
	}
	action := AutoReplyAction{Content: "fallback", Responses: []string{"", "Selected response"}}
	if got := action.SelectedContent(); got != "Selected response" {
		t.Fatalf("response=%q", got)
	}
	_, err := MatchRule(IncomingSocialEvent{Content: "unknown"}, nil)
	if !errors.Is(err, ErrRuleNotMatched) {
		t.Fatalf("expected ErrRuleNotMatched, got %v", err)
	}
}
