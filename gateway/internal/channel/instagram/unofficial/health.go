package unofficial

import "github.com/chatcepat/gateway/internal/channel"

func stopStatus(err error) string {
	switch err {
	case channel.ErrChallengeRequired:
		return "challenge_required"
	case channel.ErrSessionExpired:
		return "session_expired"
	case channel.ErrRateLimited:
		return "rate_limited"
	default:
		return "error"
	}
}
