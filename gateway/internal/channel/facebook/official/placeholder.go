// Package official reserves the stable boundary for a future official Meta
// adapter. It is intentionally not implemented in this phase.
package official

import (
	"context"

	"github.com/chatcepat/gateway/internal/channel"
)

type Adapter struct{}

func New() *Adapter                                                     { return &Adapter{} }
func (a *Adapter) Name() string                                         { return "facebook_official" }
func (a *Adapter) Connect(context.Context, channel.Connection) error    { return channel.ErrPermanent }
func (a *Adapter) Disconnect(context.Context, channel.Connection) error { return nil }
func (a *Adapter) GetAccount(context.Context, channel.Connection) (*channel.Account, error) {
	return nil, channel.ErrPermanent
}
func (a *Adapter) GetPosts(context.Context, channel.Connection, channel.GetPostsParams) ([]channel.Post, error) {
	return nil, channel.ErrPermanent
}
func (a *Adapter) GetComments(context.Context, channel.Connection, string) ([]channel.Comment, error) {
	return nil, channel.ErrPermanent
}
func (a *Adapter) ReplyComment(context.Context, channel.Connection, channel.ReplyCommentRequest) error {
	return channel.ErrPermanent
}
func (a *Adapter) SendMessage(context.Context, channel.Connection, channel.SendMessageRequest) error {
	return channel.ErrPermanent
}
func (a *Adapter) HealthCheck(context.Context, channel.Connection) (*channel.Health, error) {
	return &channel.Health{Status: "disconnected", Message: "Official Facebook adapter placeholder"}, channel.ErrPermanent
}
