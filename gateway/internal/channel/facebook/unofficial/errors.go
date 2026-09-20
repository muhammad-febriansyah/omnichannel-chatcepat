package unofficial

import "github.com/chatcepat/gateway/internal/channel"

// mapExternalError keeps provider errors inside the adapter boundary. A
// challenge, verification, or session problem must stop automation; it is
// never retried by trying to bypass the provider's controls.
func mapExternalError(err error) error {
	if err == nil {
		return nil
	}
	return channel.ErrPermanent
}
