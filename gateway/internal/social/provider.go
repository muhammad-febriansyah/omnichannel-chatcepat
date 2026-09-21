package social

import (
	"context"
	"strings"

	"github.com/chatcepat/gateway/internal/browser"
	"github.com/go-rod/rod"
)

// SocialProvider is the browser boundary. Provider implementations own their
// platform selectors; the service owns rules, safety, queueing, and state.
type SocialProvider interface {
	Platform() string
	CheckSession(ctx context.Context, account Account) error
	ScanComments(ctx context.Context, account Account) ([]IncomingSocialEvent, error)
	ScanMessages(ctx context.Context, account Account) ([]IncomingSocialEvent, error)
	ReplyComment(ctx context.Context, account Account, event IncomingSocialEvent, content string) error
	SendPrivateReply(ctx context.Context, account Account, event IncomingSocialEvent, content string) error
	ReplyMessage(ctx context.Context, account Account, event IncomingSocialEvent, content string) error
}

// ProviderFactory is injected by the command binaries to keep social domain
// types independent from platform-specific packages.
type ProviderFactory func(platform string, session *browser.Session) (SocialProvider, error)

type unavailableProvider struct{}

func (unavailableProvider) Platform() string                            { return "" }
func (unavailableProvider) CheckSession(context.Context, Account) error { return ErrAutomationNotReady }
func (unavailableProvider) ScanComments(context.Context, Account) ([]IncomingSocialEvent, error) {
	return nil, ErrAutomationNotReady
}
func (unavailableProvider) ScanMessages(context.Context, Account) ([]IncomingSocialEvent, error) {
	return nil, ErrAutomationNotReady
}
func (unavailableProvider) ReplyComment(context.Context, Account, IncomingSocialEvent, string) error {
	return ErrAutomationNotReady
}
func (unavailableProvider) SendPrivateReply(context.Context, Account, IncomingSocialEvent, string) error {
	return ErrAutomationNotReady
}
func (unavailableProvider) ReplyMessage(context.Context, Account, IncomingSocialEvent, string) error {
	return ErrAutomationNotReady
}

func DefaultProviderFactory(_ string, _ *browser.Session) (SocialProvider, error) {
	return unavailableProvider{}, nil
}

type PageWarning struct {
	URL  string
	Text string
}

// DetectPlatformWarning is deliberately text-based and conservative. It only
// stops automation; it never attempts to solve or bypass a challenge.
func DetectPlatformWarning(page *rod.Page) error {
	if page == nil {
		return nil
	}
	info, _ := page.Info()
	pageURL := ""
	if info != nil {
		pageURL = info.URL
	}
	bodyText := ""
	if body, err := page.Element("body"); err == nil {
		bodyText, _ = body.Text()
	}
	return DetectPlatformWarningText(PageWarning{URL: pageURL, Text: bodyText})
}

func DetectPlatformWarningText(page PageWarning) error {
	value := normalizeWarningText(page.URL + "\n" + page.Text)
	switch {
	case containsAny(value, "captcha", "recaptcha"):
		return ErrCaptcha
	case containsAny(value, "checkpoint", "confirm your identity", "konfirmasi identitas"):
		return ErrCheckpoint
	case containsAny(value, "suspicious login", "login mencurigakan"):
		return ErrSuspiciousLogin
	case containsAny(value, "login required", "log in to continue", "silakan masuk"):
		return ErrLoginRequired
	case containsAny(value, "temporarily blocked", "coba lagi nanti", "try again later", "temporarily unavailable"):
		return ErrTemporaryBlock
	}
	return nil
}

func normalizeWarningText(value string) string {
	return NormalizeContent(value)
}

func containsAny(value string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(value, NormalizeContent(needle)) {
			return true
		}
	}
	return false
}
