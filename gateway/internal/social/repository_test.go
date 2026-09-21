package social

import (
	"errors"
	"testing"
)

func TestValidateTargetURLByPlatform(t *testing.T) {
	tests := []struct {
		name     string
		platform string
		url      string
		wantErr  bool
	}{
		{name: "instagram post", platform: PlatformInstagram, url: "https://www.instagram.com/p/abc/"},
		{name: "facebook post", platform: PlatformFacebook, url: "https://www.facebook.com/page/posts/123"},
		{name: "wrong platform", platform: PlatformInstagram, url: "https://www.facebook.com/page/posts/123", wantErr: true},
		{name: "insecure", platform: PlatformFacebook, url: "http://www.facebook.com/page/posts/123", wantErr: true},
		{name: "lookalike host", platform: PlatformInstagram, url: "https://instagram.com.evil.test/p/abc/", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateTargetURL(tt.platform, tt.url)
			if tt.wantErr && !errors.Is(err, ErrInvalidTargetURL) {
				t.Fatalf("expected ErrInvalidTargetURL, got %v", err)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestNormalizeAccountInput(t *testing.T) {
	platform, err := normalizeAccountInput("Instagram 1", " Instagram ")
	if err != nil || platform != PlatformInstagram {
		t.Fatalf("platform=%q err=%v", platform, err)
	}
	if _, err := normalizeAccountInput("", PlatformFacebook); err == nil {
		t.Fatal("expected empty name to fail")
	}
	if _, err := normalizeAccountInput("Facebook 1", "telegram"); !errors.Is(err, ErrUnsupportedPlatform) {
		t.Fatalf("expected unsupported platform, got %v", err)
	}
}

func TestValidateJobInput(t *testing.T) {
	if err := validateJobInput(PlatformInstagram, ActionComment, "https://instagram.com/p/abc/", " interested "); err != nil {
		t.Fatalf("valid job rejected: %v", err)
	}
	if !errors.Is(validateJobInput(PlatformInstagram, "post", "https://instagram.com/p/abc/", "x"), ErrUnsupportedAction) {
		t.Fatal("expected unsupported action")
	}
	if !errors.Is(validateJobInput(PlatformInstagram, ActionComment, "https://instagram.com/p/abc/", ""), ErrContentRequired) {
		t.Fatal("expected missing content")
	}
}
