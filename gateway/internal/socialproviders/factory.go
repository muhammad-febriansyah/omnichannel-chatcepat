package socialproviders

import (
	"fmt"

	"github.com/chatcepat/gateway/internal/browser"
	"github.com/chatcepat/gateway/internal/social"
	"github.com/chatcepat/gateway/internal/social/facebook"
	"github.com/chatcepat/gateway/internal/social/instagram"
)

func Factory(platform string, session *browser.Session) (social.SocialProvider, error) {
	switch platform {
	case social.PlatformInstagram:
		return instagram.New(session), nil
	case social.PlatformFacebook:
		return facebook.New(session), nil
	default:
		return nil, fmt.Errorf("unsupported social provider %q", platform)
	}
}
