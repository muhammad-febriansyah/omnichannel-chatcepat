package social

import (
	"context"
	"github.com/chatcepat/gateway/internal/testbrowser"
	"github.com/go-rod/rod"
	"testing"
)

func TestScannerVisitsConfiguredPostAndLoadsDifferentUsers(t *testing.T) {
	b := testbrowser.New(t)
	account := Account{Platform: PlatformInstagram, CommentPostURLs: []string{"https://instagram.com/p/one/"}}
	visited := ""
	events, err := ScanCommentPosts(context.Background(), account, func(_ context.Context, url string) (*rod.Page, error) {
		visited = url
		page := b.MustPage()
		page.MustSetDocumentContent(`<html><body><article data-comment-id="a" data-user-id="alice">Mau</article><button aria-label="Load more comments" onclick="this.remove();setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<article data-comment-id=&quot;b&quot; data-user-id=&quot;bob&quot;>Mau</article>'), 900)">More comments</button></body></html>`)
		return page, nil
	}, func(page *rod.Page) []IncomingSocialEvent {
		var events []IncomingSocialEvent
		for _, node := range page.MustElements("[data-comment-id]") {
			events = append(events, IncomingSocialEvent{ExternalID: *node.MustAttribute("data-comment-id"), AuthorExternalID: *node.MustAttribute("data-user-id"), Content: node.MustText()})
		}
		return events
	})
	if err != nil {
		t.Fatal(err)
	}
	if visited != "https://www.instagram.com/p/one" || len(events) != 2 || events[0].AuthorExternalID == events[1].AuthorExternalID {
		t.Fatalf("visited=%s events=%+v", visited, events)
	}
	if *events[1].TargetURL != visited {
		t.Fatal("incorrect target URL")
	}
}

func TestFindCommentLoadsLaterPage(t *testing.T) {
	page := testbrowser.New(t).MustPage()
	page.MustSetDocumentContent(`<html><body><article data-comment-id="a">Mau</article><button onclick="this.insertAdjacentHTML('beforebegin', '<article data-comment-id=&quot;b&quot;>Mau juga</article>');this.remove()">Lihat komentar lainnya</button></body></html>`)
	node, err := FindComment(page, "b")
	if err != nil {
		t.Fatal(err)
	}
	if node.MustText() != "Mau juga" {
		t.Fatal("wrong comment")
	}
}
