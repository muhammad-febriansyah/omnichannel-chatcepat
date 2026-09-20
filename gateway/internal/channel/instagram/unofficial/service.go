// Package unofficial keeps the temporary Instagram implementation isolated.
// There is no credential scraping, challenge bypass, stealth browser, proxy
// rotation, or mass-engagement logic here.
package unofficial

import (
	"context"
	"errors"

	"github.com/chatcepat/gateway/internal/channel"
)

var ErrNotConfigured = errors.New("instagram unofficial provider is not configured")

type Adapter struct {
	sessions InstagramSessionProvider
}

func New() *Adapter                                                     { return &Adapter{sessions: safeSessionProvider{}} }
func (a *Adapter) Name() string                                         { return "instagram_unofficial" }
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

func (a *Adapter) HealthCheck(context.Context, channel.Connection) (*channel.Health, error) {
	err := a.sessions.Validate(context.Background(), nil)
	if errors.Is(err, channel.ErrChallengeRequired) {
		return mapHealth("challenge_required"), channel.ErrChallengeRequired
	}
	return mapHealth(stopStatus(err)), mapExternalError(err)
}
