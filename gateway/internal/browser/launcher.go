package browser

import (
	"context"
	"fmt"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
)

type Launcher struct {
	Headless  bool
	NoSandbox bool
}

func (l Launcher) Launch(ctx context.Context, profile Profile) (*rod.Browser, error) {
	if err := profile.Validate(); err != nil {
		return nil, err
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	launch := launcher.New().UserDataDir(profile.Path).Headless(l.Headless)
	if l.NoSandbox {
		launch = launch.NoSandbox(true)
	}
	url, err := launch.Launch()
	if err != nil {
		return nil, fmt.Errorf("launch chromium profile %s: %w", profile, err)
	}

	browser := rod.New().ControlURL(url)
	if err := browser.Connect(); err != nil {
		return nil, fmt.Errorf("connect rod to profile %s: %w", profile, err)
	}
	return browser, nil
}
