// Package mock is the safe development Facebook driver. It never contacts
// Facebook and is suitable for local end-to-end tests.
package mock

import (
	"context"
	"fmt"

	"github.com/chatcepat/gateway/internal/channel"
)

type Adapter struct{}

func New() *Adapter                                                     { return &Adapter{} }
func (a *Adapter) Name() string                                         { return "facebook_mock" }
func (a *Adapter) Connect(context.Context, channel.Connection) error    { return nil }
func (a *Adapter) Disconnect(context.Context, channel.Connection) error { return nil }

func (a *Adapter) GetAccount(_ context.Context, connection channel.Connection) (*channel.Account, error) {
	name := "mock_page"
	if value, ok := connection.Metadata["username"].(string); ok && value != "" {
		name = value
	}
	return &channel.Account{ID: connection.ID, Username: name, Name: connection.Name}, nil
}

func (a *Adapter) GetPosts(context.Context, channel.Connection, channel.GetPostsParams) ([]channel.Post, error) {
	return []channel.Post{{ExternalID: "facebook-post-001", Type: "post", Caption: "Mock Facebook post"}}, nil
}

func (a *Adapter) GetComments(context.Context, channel.Connection, string) ([]channel.Comment, error) {
	return []channel.Comment{}, nil
}

func (a *Adapter) ReplyComment(_ context.Context, _ channel.Connection, req channel.ReplyCommentRequest) error {
	if req.Text == "" || req.CommentID == "" {
		return fmt.Errorf("mock Facebook reply requires comment_id and text")
	}
	return nil
}

func (a *Adapter) SendMessage(_ context.Context, _ channel.Connection, req channel.SendMessageRequest) error {
	if req.RecipientID == "" || req.Text == "" {
		return fmt.Errorf("mock Facebook message requires recipient_id and text")
	}
	return nil
}

func (a *Adapter) HealthCheck(context.Context, channel.Connection) (*channel.Health, error) {
	return &channel.Health{Status: "healthy", Message: "Mock Facebook adapter is ready"}, nil
}
