package unofficial

import "github.com/chatcepat/gateway/internal/channel"

// mapExternalError is deliberately narrow. Challenge/checkpoint/2FA always
// become a stop signal; no automatic bypass is attempted.
func mapExternalError(err error) error {
	if err == nil {
		return nil
	}
	return channel.ErrPermanent
}
