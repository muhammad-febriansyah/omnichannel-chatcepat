package browser

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func TestNewProfileRejectsPathTraversal(t *testing.T) {
	_, err := NewProfile("/tmp/browser", "instagram", "../other")
	if !errors.Is(err, ErrInvalidProfile) {
		t.Fatalf("expected ErrInvalidProfile, got %v", err)
	}
}

func TestCreateProfileUsesPlatformAndAccountID(t *testing.T) {
	root := t.TempDir()
	m := NewManager(root, true, true)
	p, err := m.CreateProfile(context.Background(), "facebook", "account-1")
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(root, "facebook", "account-1"); p.Path != want {
		t.Fatalf("profile path = %q, want %q", p.Path, want)
	}
	ok, err := m.ProfileExists("facebook", "account-1")
	if err != nil || !ok {
		t.Fatalf("profile should exist, exists=%v err=%v", ok, err)
	}
}
