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

type FacebookSessionProvider interface {
	Login(context.Context, LoginRequest) (*Session, error)
	Restore(context.Context, []byte) (*Session, error)
	Validate(context.Context, *Session) error
}

// safeSessionProvider is intentionally inert until a reviewed provider is
// selected. Passwords are only accepted at the login boundary and are never
// persisted by the core application.
type safeSessionProvider struct{}

func (safeSessionProvider) Login(context.Context, LoginRequest) (*Session, error) {
	return nil, ErrNotConfigured
}
func (safeSessionProvider) Restore(context.Context, []byte) (*Session, error) {
	return nil, ErrNotConfigured
}
func (safeSessionProvider) Validate(context.Context, *Session) error { return ErrNotConfigured }
