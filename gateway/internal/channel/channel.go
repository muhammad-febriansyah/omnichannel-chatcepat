// Package channel defines the stable boundary between business logic and any
// external channel implementation. Automation and persistence depend on this
// package only; Instagram drivers live below internal/channel/instagram.
package channel

import "context"

type Connection struct {
	ID          string
	WorkspaceID string
	ChannelType string
	Name        string
	Status      string
	Metadata    map[string]any
	Credentials []byte
	SessionData []byte
}

// ChannelConnection is the public contract name used by the omnichannel
// architecture. Connection remains as the concise internal spelling.
type ChannelConnection = Connection

type Account struct {
	ID       string         `json:"id"`
	Username string         `json:"username"`
	Name     string         `json:"name"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type Post struct {
	ExternalID string
	Type       string
	Caption    string
	MediaURL   string
	Permalink  string
}

type Comment struct {
	ExternalID string
	PostID     string
	Username   string
	UserID     string
	Text       string
}

type GetPostsParams struct {
	Limit  int
	Cursor string
}

type ReplyCommentRequest struct {
	CommentID string
	Text      string
}

type SendMessageRequest struct {
	RecipientID string
	Text        string
}

type Health struct {
	Status  string
	Message string
}

type ChannelAccount = Account
type ChannelHealth = Health

type Channel interface {
	Name() string
	Connect(context.Context, Connection) error
	Disconnect(context.Context, Connection) error
	GetAccount(context.Context, Connection) (*Account, error)
	GetPosts(context.Context, Connection, GetPostsParams) ([]Post, error)
	GetComments(context.Context, Connection, string) ([]Comment, error)
	ReplyComment(context.Context, Connection, ReplyCommentRequest) error
	SendMessage(context.Context, Connection, SendMessageRequest) error
	HealthCheck(context.Context, Connection) (*Health, error)
}
