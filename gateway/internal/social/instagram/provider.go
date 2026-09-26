package instagram

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/browser"
	"github.com/chatcepat/gateway/internal/social"
	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/proto"
)

const (
	homeURL  = "https://www.instagram.com/"
	inboxURL = "https://www.instagram.com/direct/inbox/"
)

type Provider struct{ session *browser.Session }

func New(session *browser.Session) *Provider { return &Provider{session: session} }
func (p *Provider) Platform() string         { return social.PlatformInstagram }

func (p *Provider) CheckSession(ctx context.Context, _ social.Account) error {
	page, err := p.open(ctx, homeURL)
	if err != nil {
		return social.ErrNavigationFailed
	}
	defer page.Close()
	if err := social.DetectPlatformWarning(page); err != nil {
		return err
	}
	info, _ := page.Info()
	if info != nil && strings.Contains(strings.ToLower(info.URL), "/accounts/login") {
		return social.ErrLoginRequired
	}
	if _, err := findFirst(page, selectors.CommentInput); err == nil {
		return nil
	}
	if body, err := page.Element("body"); err == nil {
		text, _ := body.Text()
		if strings.Contains(strings.ToLower(text), "log in") || strings.Contains(strings.ToLower(text), "masuk") {
			return social.ErrLoginRequired
		}
	}
	if _, err := findFirst(page, selectors.SessionMarkers); err != nil {
		return social.ErrSessionExpired
	}
	return nil
}

func (p *Provider) ScanComments(ctx context.Context, account social.Account) ([]social.IncomingSocialEvent, error) {
	return social.ScanCommentPosts(ctx, account, p.open, func(page *rod.Page) []social.IncomingSocialEvent {
		return scanEvents(page, account, social.EventSourceComment, selectors.CommentNodes)
	})
}

func (p *Provider) ScanMessages(ctx context.Context, account social.Account) ([]social.IncomingSocialEvent, error) {
	page, err := p.open(ctx, inboxURL)
	if err != nil {
		return nil, social.ErrNavigationFailed
	}
	defer page.Close()
	if err := social.DetectPlatformWarning(page); err != nil {
		return nil, err
	}
	return scanEvents(page, account, social.EventSourceMessage, selectors.MessageNodes), nil
}

func (p *Provider) ReplyComment(ctx context.Context, account social.Account, event social.IncomingSocialEvent, content string) error {
	if event.SourceType != social.EventSourceComment || event.TargetURL == nil || strings.TrimSpace(*event.TargetURL) == "" {
		return social.ErrCommentNotFound
	}
	page, err := p.open(ctx, *event.TargetURL)
	if err != nil {
		return social.ErrNavigationFailed
	}
	defer page.Close()
	if err := social.DetectPlatformWarning(page); err != nil {
		return err
	}
	return submitReply(page, selectors.CommentInput, selectors.Submit, selectors.Reply, content, event.ExternalID)
}

func (p *Provider) SendPrivateReply(ctx context.Context, account social.Account, event social.IncomingSocialEvent, content string) error {
	if event.SourceType != social.EventSourceComment || event.AuthorExternalID == accountExternalID(account) {
		return social.ErrPrivateReplyUnavailable
	}
	if event.TargetURL == nil || strings.TrimSpace(*event.TargetURL) == "" {
		return social.ErrPrivateReplyUnavailable
	}
	page, err := p.open(ctx, *event.TargetURL)
	if err != nil {
		return social.ErrNavigationFailed
	}
	defer page.Close()
	if err := social.DetectPlatformWarning(page); err != nil {
		return err
	}
	node, err := findEventNode(page, event.ExternalID, "data-comment-id")
	if err != nil {
		return social.ErrPrivateReplyUnavailable
	}
	button, err := findFirstIn(node, selectors.PrivateReply)
	if err != nil {
		return social.ErrPrivateReplyUnavailable
	}
	if err := button.Click(proto.InputMouseButtonLeft, 1); err != nil {
		return social.ErrPrivateReplyUnavailable
	}
	return submitReply(page, selectors.MessageInput, selectors.Submit, nil, content, "")
}

func (p *Provider) ReplyMessage(ctx context.Context, account social.Account, event social.IncomingSocialEvent, content string) error {
	if event.SourceType != social.EventSourceMessage || event.AuthorExternalID == accountExternalID(account) {
		return social.ErrConversationNotFound
	}
	page, err := p.open(ctx, inboxURL)
	if err != nil {
		return social.ErrNavigationFailed
	}
	defer page.Close()
	if err := social.DetectPlatformWarning(page); err != nil {
		return err
	}
	if _, err := findEventNode(page, event.ExternalID, "data-message-id"); err != nil {
		return social.ErrConversationNotFound
	}
	return submitReply(page, selectors.MessageInput, selectors.Submit, nil, content, "")
}

func (p *Provider) open(ctx context.Context, target string) (*rod.Page, error) {
	if p.session == nil || p.session.Browser == nil {
		return nil, social.ErrAutomationNotReady
	}
	page, err := p.session.Browser.Page(proto.TargetCreateTarget{URL: target})
	if err != nil {
		return nil, err
	}
	page = page.Context(ctx).Timeout(20 * time.Second)
	if err := page.WaitLoad(); err != nil {
		_ = page.Close()
		return nil, err
	}
	return page, nil
}

func scanEvents(page *rod.Page, account social.Account, source string, nodeSelectors []string) []social.IncomingSocialEvent {
	for _, selector := range nodeSelectors {
		nodes, err := page.Elements(selector)
		if err != nil || len(nodes) == 0 {
			continue
		}
		events := make([]social.IncomingSocialEvent, 0, len(nodes))
		info, _ := page.Info()
		targetURL := ""
		if info != nil {
			targetURL = info.URL
		}
		for _, node := range nodes {
			externalID := firstAttribute(node, "data-comment-id", "data-message-id", "data-id")
			if externalID == "" {
				continue
			}
			eventURL := pageURLForNode(node, targetURL)
			if source == social.EventSourceComment && eventURL == "" {
				continue
			}
			content, _ := node.Text()
			if source == social.EventSourceComment {
				content = social.CommentText(node)
			}
			eventTarget := eventURL
			events = append(events, social.IncomingSocialEvent{
				Platform: social.PlatformInstagram, AccountID: account.ID, SourceType: source,
				ExternalID: externalID, AuthorExternalID: firstAttribute(node, "data-author-id", "data-user-id"),
				Content: strings.TrimSpace(content), TargetURL: &eventTarget, ReceivedAt: time.Now().UTC(),
			})
		}
		return events
	}
	return nil
}

func pageURLForNode(node *rod.Element, fallback string) string {
	if post, err := social.CanonicalPostURL(social.PlatformInstagram, fallback); err == nil {
		return post
	}
	current := node
	for depth := 0; depth < 8 && current != nil; depth++ {
		for _, selector := range selectors.PostLinks {
			link, err := current.Element(selector)
			if err != nil {
				continue
			}
			href := firstAttribute(link, "href")
			if href == "" {
				continue
			}
			parsed, err := url.Parse(href)
			if err != nil {
				continue
			}
			if !parsed.IsAbs() {
				base, baseErr := url.Parse(homeURL)
				if baseErr != nil {
					continue
				}
				parsed = base.ResolveReference(parsed)
			}
			return parsed.String()
		}
		parent, err := current.Parent()
		if err != nil {
			break
		}
		current = parent
	}
	if strings.Contains(fallback, "/p/") || strings.Contains(fallback, "/reel/") || strings.Contains(fallback, "/tv/") {
		return fallback
	}
	return ""
}

func submitReply(page *rod.Page, inputSelectors, submitSelectors, replySelectors []string, content, externalID string) error {
	var scope *rod.Element
	if externalID != "" {
		var err error
		scope, err = findEventNode(page, externalID, "data-comment-id")
		if err != nil {
			return social.ErrCommentNotFound
		}
	}
	if replySelectors != nil {
		if scope == nil {
			return social.ErrCommentNotFound
		}
		button, err := findFirstIn(scope, replySelectors)
		if err != nil {
			return social.ErrCommentNotFound
		}
		if err := button.Click(proto.InputMouseButtonLeft, 1); err != nil {
			return social.ErrReplyFailed
		}
	}
	input, err := findFirst(page, inputSelectors)
	if scope != nil {
		input, err = findFirstIn(scope, inputSelectors)
	}
	if err != nil {
		return social.ErrElementNotFound
	}
	if err := input.Input(content); err != nil {
		return social.ErrReplyFailed
	}
	submit, err := findFirst(page, submitSelectors)
	if scope != nil {
		submit, err = findFirstIn(scope, submitSelectors)
	}
	if err != nil {
		return social.ErrElementNotFound
	}
	if err := submit.Click(proto.InputMouseButtonLeft, 1); err != nil {
		return social.ErrReplyFailed
	}
	if externalID != "" {
		return nil
	}
	return nil
}

func findFirst(page *rod.Page, candidates []string) (*rod.Element, error) {
	return social.FindVisibleElement(page, candidates)
}

func findFirstIn(scope *rod.Element, candidates []string) (*rod.Element, error) {
	return social.FindVisibleElement(scope, candidates)
}

func findEventNode(page *rod.Page, externalID, attribute string) (*rod.Element, error) {
	if attribute == "data-comment-id" {
		return social.FindComment(page, externalID)
	}
	if strings.TrimSpace(externalID) == "" {
		return nil, social.ErrElementNotFound
	}
	escaped := strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(externalID)
	return social.FindVisibleElement(page, []string{`[` + attribute + `="` + escaped + `"]`})
}

func firstAttribute(element *rod.Element, names ...string) string {
	for _, name := range names {
		if value, err := element.Attribute(name); err == nil && value != nil && strings.TrimSpace(*value) != "" {
			return strings.TrimSpace(*value)
		}
	}
	return ""
}

func accountExternalID(account social.Account) string {
	if account.ExternalUserID == nil {
		return ""
	}
	return strings.TrimSpace(*account.ExternalUserID)
}
