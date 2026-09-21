package browser

import (
	"context"
	"os"
	"path/filepath"
	"sync"

	"github.com/go-rod/rod"
)

type Manager struct {
	root     string
	launcher Launcher

	mu    sync.Mutex
	locks map[string]chan struct{}
}

type Session struct {
	AccountID string
	Profile   Profile
	Browser   *rod.Browser

	releaseOnce sync.Once
	release     func()
}

func NewManager(root string, headless, noSandbox bool) *Manager {
	return &Manager{
		root:     root,
		launcher: Launcher{Headless: headless, NoSandbox: noSandbox},
		locks:    make(map[string]chan struct{}),
	}
}

func (m *Manager) Profile(platform, accountID string) (Profile, error) {
	return NewProfile(m.root, platform, accountID)
}

func (m *Manager) CreateProfile(_ context.Context, platform, accountID string) (Profile, error) {
	profile, err := m.Profile(platform, accountID)
	if err != nil {
		return Profile{}, err
	}
	if err := os.MkdirAll(profile.Path, 0o700); err != nil {
		return Profile{}, err
	}
	return profile, nil
}

func (m *Manager) ProfileExists(platform, accountID string) (bool, error) {
	profile, err := m.Profile(platform, accountID)
	if err != nil {
		return false, err
	}
	info, err := os.Stat(profile.Path)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return info.IsDir(), nil
}

func (m *Manager) DeleteProfile(ctx context.Context, platform, accountID string) error {
	profile, err := m.Profile(platform, accountID)
	if err != nil {
		return err
	}
	release, err := m.acquireLocal(ctx, profile.String())
	if err != nil {
		return err
	}
	defer release()
	if err := os.RemoveAll(profile.Path); err != nil {
		return err
	}
	return nil
}

// OpenProfile serializes access to a persistent Chromium profile within this
// process. The social service adds a Redis lock around this method so the same
// guarantee holds across API and worker processes.
func (m *Manager) OpenProfile(ctx context.Context, platform, accountID string) (*Session, error) {
	profile, err := m.CreateProfile(ctx, platform, accountID)
	if err != nil {
		return nil, err
	}
	release, err := m.acquireLocal(ctx, profile.String())
	if err != nil {
		return nil, err
	}
	browser, err := m.launcher.Launch(ctx, profile)
	if err != nil {
		release()
		return nil, err
	}
	return &Session{AccountID: accountID, Profile: profile, Browser: browser, release: release}, nil
}

func (m *Manager) CloseProfile(session *Session) error {
	if session == nil {
		return nil
	}
	var closeErr error
	if session.Browser != nil {
		closeErr = session.Browser.Close()
	}
	session.releaseOnce.Do(session.release)
	return closeErr
}

func (s *Session) Close() error {
	if s == nil {
		return nil
	}
	if s.Browser != nil {
		_ = s.Browser.Close()
	}
	s.releaseOnce.Do(s.release)
	return nil
}

func (m *Manager) acquireLocal(ctx context.Context, key string) (func(), error) {
	m.mu.Lock()
	lock := m.locks[key]
	if lock == nil {
		lock = make(chan struct{}, 1)
		lock <- struct{}{}
		m.locks[key] = lock
	}
	m.mu.Unlock()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-lock:
		return func() { lock <- struct{}{} }, nil
	}
}

func (m *Manager) Root() string { return filepath.Clean(m.root) }
