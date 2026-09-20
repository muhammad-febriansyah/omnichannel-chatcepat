// Package unofficial isolates the temporary Facebook unofficial provider.
// This package is deliberately inert until a compliant provider implementation
// is reviewed. It must not contain anti-detection or restriction-evasion code.
package unofficial

import (
	"context"
	"errors"

	"github.com/chatcepat/gateway/internal/channel"
)

var ErrNotConfigured = errors.New("facebook unofficial provider is not configured")

type Adapter struct {
	sessions FacebookSessionProvider
}

func New() *Adapter { return &Adapter{sessions: safeSessionProvider{}} }

func (a *Adapter) Name() string                                         { return "facebook_unofficial" }
func (a *Adapter) Connect(context.Context, channel.Connection) error    { return ErrNotConfigured }
func (a *Adapter) Disconnect(context.Context, channel.Connection) error { return nil }
func (a *Adapter) GetAccount(context.Context, channel.Connection) (*channel.Account, error) {
	return nil, ErrNotConfigured
}
func (a *Adapter) GetPosts(context.Context, channel.Connection, channel.GetPostsParams) ([]channel.Post, error) {
	return nil, ErrNotConfigured
}
func (a *Adapter) GetComments(context.Context, channel.Connection, string) ([]channel.Comment, error) {
	return nil, ErrNotConfigured
}
func (a *Adapter) ReplyComment(context.Context, channel.Connection, channel.ReplyCommentRequest) error {
	return ErrNotConfigured
}
func (a *Adapter) SendMessage(context.Context, channel.Connection, channel.SendMessageRequest) error {
	return ErrNotConfigured
}

func (a *Adapter) HealthCheck(ctx context.Context, _ channel.Connection) (*channel.Health, error) {
	err := a.sessions.Validate(ctx, nil)
	if errors.Is(err, channel.ErrChallengeRequired) {
		return &channel.Health{Status: "challenge_required", Message: "Facebook requires manual verification"}, channel.ErrChallengeRequired
	}
	return &channel.Health{Status: "error", Message: "Facebook unofficial provider is not configured"}, mapExternalError(err)
}
