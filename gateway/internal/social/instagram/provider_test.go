package instagram

import (
	"github.com/chatcepat/gateway/internal/social"
	"github.com/chatcepat/gateway/internal/testbrowser"
	"testing"
)

func TestCommentKeywordExcludesControlsAndReplyTargetsAuthor(t *testing.T) {
	page := testbrowser.New(t).MustPage()
	page.MustSetDocumentContent(`<html><body><article data-comment-id="a"><a href="/alice">Alice</a><span>Mau</span><button aria-label="Reply">Reply</button><textarea aria-label="comment"></textarea><button type="submit" onclick="window.wrong=true">Send</button></article><article data-comment-id="b"><span data-comment-text>Mau</span><button aria-label="Reply">Reply</button><textarea id="right" aria-label="comment"></textarea><button type="submit" onclick="window.sent=document.querySelector('#right').value">Send</button></article></body></html>`)
	first := page.MustElement(`[data-comment-id="a"]`)
	if got := social.CommentText(first); got != "Mau" {
		t.Fatalf("keyword polluted by author/buttons: %q", got)
	}
	if err := submitReply(page, selectors.CommentInput, selectors.Submit, selectors.Reply, "Info B", "b"); err != nil {
		t.Fatal(err)
	}
	if page.MustEval(`() => window.sent`).Str() != "Info B" || page.MustEval(`() => !!window.wrong`).Bool() {
		t.Fatal("wrong recipient")
	}
	if err := submitReply(page, selectors.CommentInput, selectors.Submit, selectors.Reply, "bad", ""); err == nil {
		t.Fatal("empty target accepted")
	}
}
