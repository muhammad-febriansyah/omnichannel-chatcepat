package social

import "testing"

func TestCommentActionKeySeparatesUsersPostsAccountsAndActions(t *testing.T) {
	post := "https://instagram.com/p/one/?igsh=tracking"
	event := IncomingSocialEvent{Platform: PlatformInstagram, AccountID: "account", SourceType: EventSourceComment, ExternalID: "first", AuthorExternalID: "alice", TargetURL: &post}
	key := CommentActionKey(event, ActionReplyComment)
	event.ExternalID = "another-comment"
	canonical := "https://www.instagram.com/p/one"
	event.TargetURL = &canonical
	if got := CommentActionKey(event, ActionReplyComment); got != key {
		t.Fatal("same author/post must dedupe across comment IDs and tracking URLs")
	}
	for _, change := range []func(*IncomingSocialEvent){
		func(e *IncomingSocialEvent) { e.AuthorExternalID = "bob" },
		func(e *IncomingSocialEvent) { url := "https://instagram.com/p/two/"; e.TargetURL = &url },
		func(e *IncomingSocialEvent) { e.AccountID = "another-account" },
	} {
		copy := event
		change(&copy)
		if CommentActionKey(copy, ActionReplyComment) == key {
			t.Fatal("distinct recipient/post/account merged")
		}
	}
	if CommentActionKey(event, ActionSendPrivateReply) == key {
		t.Fatal("public and private replies merged")
	}
	event.SourceType = EventSourceMessage
	if CommentActionKey(event, ActionReplyMessage) != "" {
		t.Fatal("DM conversation deduped by post")
	}
}

func TestCanonicalCommentTargets(t *testing.T) {
	for _, raw := range []string{"https://evil.test/p/a", "https://instagram.com/", "https://instagram.com/direct/inbox/", "https://instagram.com.evil.test/p/a", "https://user@instagram.com/p/a", "https://instagram.com:8443/p/a"} {
		if _, err := CanonicalPostURL(PlatformInstagram, raw); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
	posts, err := NormalizeCommentPostURLs(PlatformInstagram, []string{"https://instagram.com/p/a/", "https://www.instagram.com/p/a?igsh=1"})
	if err != nil || len(posts) != 1 {
		t.Fatalf("posts=%v err=%v", posts, err)
	}
	one, err := CanonicalPostURL(PlatformFacebook, "https://m.facebook.com/permalink.php?story_fbid=123&id=page&comment_id=99")
	if err != nil || one != "https://www.facebook.com/permalink.php?id=page&story_fbid=123" {
		t.Fatalf("post=%s err=%v", one, err)
	}
	two, _ := CanonicalPostURL(PlatformFacebook, "https://facebook.com/permalink.php?story_fbid=456&id=page")
	if one == two {
		t.Fatal("query-based posts merged")
	}
}
