package social

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/proto"
)

// FindVisibleElement uses immediate queries: a missing first selector must not
// consume the page timeout and prevent fallback selectors from being tried.
func FindVisibleElement(scope interface {
	Elements(string) (rod.Elements, error)
}, selectors []string) (*rod.Element, error) {
	for _, selector := range selectors {
		nodes, err := scope.Elements(selector)
		if err != nil {
			continue
		}
		for _, node := range nodes {
			if visible, err := node.Visible(); err == nil && visible {
				return node, nil
			}
		}
	}
	// Rod uses native CSS, so Playwright's :has-text() is not supported.
	// Localized action labels are matched inside the same comment scope.
	labels := map[string]bool{}
	for _, selector := range selectors {
		if !strings.HasPrefix(selector, "button") && !strings.HasPrefix(selector, "[role='button']") {
			continue
		}
		if strings.Contains(selector, "reply") {
			labels["reply"], labels["balas"] = true, true
		}
		if strings.Contains(selector, "message") {
			labels["message"], labels["pesan"], labels["kirim pesan"] = true, true, true
		}
	}
	if len(labels) > 0 {
		nodes, err := scope.Elements("button, [role='button']")
		if err == nil {
			for _, node := range nodes {
				text, _ := node.Text()
				if labels[strings.ToLower(strings.TrimSpace(text))] {
					if visible, _ := node.Visible(); visible {
						return node, nil
					}
				}
			}
		}
	}
	return nil, ErrElementNotFound
}

func CommentText(node *rod.Element) string {
	value, err := node.Eval(`() => {
		const text = this.querySelector('[data-comment-text]');
		if (text) return text.textContent.trim();
		const copy = this.cloneNode(true);
		copy.querySelectorAll('button, [role="button"], textarea, input, [contenteditable], time, a, [data-comment-id]').forEach(el => el.remove());
		return copy.textContent.trim();
	}`)
	if err != nil {
		return ""
	}
	return value.Value.Str()
}

// PaginateComments accumulates events before each load-more click, including
// virtualized pages where earlier comments disappear from the DOM.
func PaginateComments(ctx context.Context, page *rod.Page, read func() []IncomingSocialEvent) ([]IncomingSocialEvent, error) {
	result := []IncomingSocialEvent{}
	seen := map[string]bool{}
	for step := 0; step < 100; step++ {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		if err := DetectPlatformWarning(page); err != nil {
			return result, err
		}
		for _, event := range read() {
			if !seen[event.ExternalID] {
				seen[event.ExternalID] = true
				result = append(result, event)
			}
		}
		if err := ctx.Err(); err != nil {
			return result, err
		}
		button, err := FindVisibleElement(page, []string{
			"button[aria-label*='more comments' i]", "[role='button'][aria-label*='more comments' i]",
			"button[aria-label*='komentar lainnya' i]", "[role='button'][aria-label*='komentar lainnya' i]",
			"button[aria-label*='previous comments' i]", "button[aria-label*='komentar sebelumnya' i]",
		})
		if err != nil {
			buttons, queryErr := page.Elements("button, [role='button']")
			if queryErr != nil {
				return result, queryErr
			}
			for _, candidate := range buttons {
				text, _ := candidate.Text()
				text = strings.ToLower(strings.TrimSpace(text))
				if strings.Contains(text, "more comments") || strings.Contains(text, "previous comments") || strings.Contains(text, "komentar lainnya") || strings.Contains(text, "komentar sebelumnya") {
					if visible, _ := candidate.Visible(); visible {
						button, err = candidate, nil
						break
					}
				}
			}
		}
		if err != nil {
			return result, nil
		}
		before, err := commentPageState(page)
		if err != nil {
			return result, err
		}
		if err := button.Click(proto.InputMouseButtonLeft, 1); err != nil {
			return result, err
		}
		if err := waitCommentPageChange(ctx, page, before); err != nil {
			return result, err
		}
	}
	return result, fmt.Errorf("comment pagination exceeded 100 pages")
}

func commentPageState(page *rod.Page) (string, error) {
	state, err := page.Eval(`() => JSON.stringify(Array.from(document.querySelectorAll('[data-comment-id]')).map(node => [node.getAttribute('data-comment-id'), node.textContent]))`)
	if err != nil {
		return "", err
	}
	return state.Value.Str(), nil
}

func waitCommentPageChange(ctx context.Context, page *rod.Page, before string) error {
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(100 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-deadline.C:
			return fmt.Errorf("comment pagination did not load new comments")
		case <-tick.C:
			state, err := commentPageState(page)
			if err != nil {
				return err
			}
			if state != before && state != "[]" {
				return nil
			}
		}
	}
}

// FindComment loads later comment pages as needed before resolving a reply.
// Missing IDs fail closed: never fall back to another comment on the post.
func FindComment(page *rod.Page, externalID string) (*rod.Element, error) {
	if strings.TrimSpace(externalID) == "" {
		return nil, ErrCommentNotFound
	}
	escaped := strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(externalID)
	selector := `[data-comment-id="` + escaped + `"]`
	if node, err := FindVisibleElement(page, []string{selector}); err == nil {
		return node, nil
	}
	ctx, cancel := context.WithCancel(page.GetContext())
	defer cancel()
	var found *rod.Element
	_, err := PaginateComments(ctx, page, func() []IncomingSocialEvent {
		if node, findErr := FindVisibleElement(page, []string{selector}); findErr == nil {
			found = node
			cancel()
		}
		return nil
	})
	if found != nil {
		return found, nil
	}
	if err != nil {
		return nil, err
	}
	return nil, ErrCommentNotFound
}

func ScanCommentPosts(ctx context.Context, account Account, open func(context.Context, string) (*rod.Page, error), read func(*rod.Page) []IncomingSocialEvent) ([]IncomingSocialEvent, error) {
	posts, err := NormalizeCommentPostURLs(account.Platform, account.CommentPostURLs)
	if err != nil {
		return nil, err
	}
	if len(posts) == 0 {
		return nil, fmt.Errorf("configure comment_post_urls before enabling the comment scanner")
	}
	result := []IncomingSocialEvent{}
	for _, post := range posts {
		page, err := open(ctx, post)
		if err != nil {
			return result, err
		}
		events, scanErr := PaginateComments(ctx, page, func() []IncomingSocialEvent { return read(page) })
		_ = page.Close()
		for i := range events {
			events[i].TargetURL = &post
			events[i].ParentExternalID = &post
		}
		result = append(result, events...)
		if scanErr != nil {
			return result, scanErr
		}
	}
	return result, nil
}
