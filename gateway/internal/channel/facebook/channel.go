// Package facebook contains the stable Facebook channel entrypoint.
// Provider-specific code stays below this package so core automation only
// depends on channel.Channel.
package facebook

import (
	"fmt"

	"github.com/chatcepat/gateway/internal/channel"
	"github.com/chatcepat/gateway/internal/channel/facebook/mock"
	"github.com/chatcepat/gateway/internal/channel/facebook/unofficial"
)

func New(driver string) (channel.Channel, error) {
	switch driver {
	case "mock":
		return mock.New(), nil
	case "unofficial":
		return unofficial.New(), nil
	default:
		return nil, fmt.Errorf("unknown or disabled Facebook driver %q", driver)
	}
}

// NewFacebookChannel is the stable factory entrypoint for future callers.
func NewFacebookChannel(driver string) (channel.Channel, error) { return New(driver) }
