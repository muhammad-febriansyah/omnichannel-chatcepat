package facebook

import (
	"github.com/chatcepat/gateway/internal/testbrowser"
	"testing"
)

func TestReplyTargetsExactCommentAndComposer(t *testing.T) {
	b := testbrowser.New(t)
	page := b.MustPage()
	page.MustSetDocumentContent(`<html><body>
<textarea id="post" aria-label="comment"></textarea><button type="submit" onclick="window.wrong=true">Post</button>
<article data-comment-id="first"><button aria-label="Reply" onclick="window.wrong=true">Reply</button><textarea aria-label="comment"></textarea><button type="submit" onclick="window.wrong=true">Send</button></article>
<article data-comment-id="second"><button aria-label="Reply" onclick="window.chosen='second'">Reply</button><textarea id="right" aria-label="comment"></textarea><button type="submit" onclick="window.sent=document.querySelector('#right').value">Send</button></article>
</body></html>`)
	if err := submitCommentReply(page, "second", "Info untuk B"); err != nil {
		t.Fatal(err)
	}
	if got := page.MustEval(`() => [window.chosen, window.sent, !!window.wrong, document.querySelector('#post').value]`).JSON("", ""); got != `["second","Info untuk B",false,""]` {
		t.Fatal(got)
	}
	if err := submitCommentReply(page, "missing", "must not send"); err == nil {
		t.Fatal("missing comment accepted")
	}
	if page.MustEval(`() => !!window.wrong`).Bool() {
		t.Fatal("wrong composer used")
	}
}

func TestMissingReplyButtonDoesNotPostTopLevel(t *testing.T) {
	page := testbrowser.New(t).MustPage()
	page.MustSetDocumentContent(`<html><body><article data-comment-id="a">Mau</article><textarea aria-label="comment"></textarea><button type="submit" onclick="window.sent=true">Send</button></body></html>`)
	if err := submitCommentReply(page, "a", "hello"); err == nil {
		t.Fatal("missing reply button accepted")
	}
	if page.MustEval(`() => !!window.sent`).Bool() {
		t.Fatal("posted top-level comment")
	}
}

func TestMessageSelectorInterpolatesAttribute(t *testing.T) {
	page := testbrowser.New(t).MustPage()
	page.MustSetDocumentContent(`<html><body><div data-message-id="m1">Mau</div></body></html>`)
	if _, err := findEventNode(page, "m1", "data-message-id"); err != nil {
		t.Fatal(err)
	}
}
