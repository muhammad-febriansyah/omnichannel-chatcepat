// Package mock is the safe development driver. It never contacts Instagram.
package mock

import (
	"context"
	"fmt"

	"github.com/chatcepat/gateway/internal/channel"
)

type Adapter struct{}

func New() *Adapter                                                     { return &Adapter{} }
func (a *Adapter) Name() string                                         { return "instagram_mock" }
func (a *Adapter) Connect(context.Context, channel.Connection) error    { return nil }
func (a *Adapter) Disconnect(context.Context, channel.Connection) error { return nil }

func (a *Adapter) GetAccount(_ context.Context, connection channel.Connection) (*channel.Account, error) {
	username := "mock_account"
	if value, ok := connection.Metadata["username"].(string); ok && value != "" {
		username = value
	}
	return &channel.Account{ID: connection.ID, Username: username, Name: connection.Name}, nil
}

func (a *Adapter) GetPosts(context.Context, channel.Connection, channel.GetPostsParams) ([]channel.Post, error) {
	return []channel.Post{{ExternalID: "post-001", Type: "image", Caption: "Mock post"}}, nil
}

func (a *Adapter) GetComments(context.Context, channel.Connection, string) ([]channel.Comment, error) {
	return []channel.Comment{}, nil
}

func (a *Adapter) ReplyComment(_ context.Context, _ channel.Connection, req channel.ReplyCommentRequest) error {
	if req.Text == "" || req.CommentID == "" {
		return fmt.Errorf("mock reply requires comment_id and text")
	}
	return nil
}

func (a *Adapter) SendMessage(_ context.Context, _ channel.Connection, req channel.SendMessageRequest) error {
	if req.RecipientID == "" || req.Text == "" {
		return fmt.Errorf("mock message requires recipient_id and text")
	}
	return nil
}

func (a *Adapter) HealthCheck(context.Context, channel.Connection) (*channel.Health, error) {
	return &channel.Health{Status: "healthy", Message: "Mock adapter is ready"}, nil
}
