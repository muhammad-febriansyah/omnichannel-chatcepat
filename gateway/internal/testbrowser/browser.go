// Package testbrowser supplies an isolated browser for local DOM regression tests.
package testbrowser

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
)

func New(t *testing.T) *rod.Browser {
	t.Helper()
	bin := os.Getenv("SOCIAL_TEST_BROWSER")
	if bin == "" {
		t.Skip("set SOCIAL_TEST_BROWSER to a local Chromium executable")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	l := launcher.New().Bin(bin).UserDataDir(t.TempDir()).Headless(true).NoSandbox(true)
	controlURL, err := l.Launch()
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	b := rod.New().ControlURL(controlURL).Context(ctx)
	if err := b.Connect(); err != nil {
		l.Kill()
		cancel()
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = b.Close(); l.Kill(); l.Cleanup(); cancel() })
	return b
}
