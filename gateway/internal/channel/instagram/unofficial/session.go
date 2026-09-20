package unofficial

import "context"

type LoginRequest struct {
	Username string
	Password string
}

type Session struct {
	AccountID string
	Username  string
	Opaque    []byte
}

type InstagramSessionProvider interface {
	Login(context.Context, LoginRequest) (*Session, error)
	Restore(context.Context, []byte) (*Session, error)
	Validate(context.Context, *Session) error
}

// safeSessionProvider is an intentionally inert placeholder. A future adapter
// may implement the interface in this package without exposing the provider to
// core services. Passwords are accepted only for the duration of Login.
type safeSessionProvider struct{}

func (safeSessionProvider) Login(context.Context, LoginRequest) (*Session, error) {
	return nil, ErrNotConfigured
}
func (safeSessionProvider) Restore(context.Context, []byte) (*Session, error) {
	return nil, ErrNotConfigured
}
func (safeSessionProvider) Validate(context.Context, *Session) error { return ErrNotConfigured }
