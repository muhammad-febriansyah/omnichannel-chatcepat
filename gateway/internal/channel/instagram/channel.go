package instagram

import (
	"fmt"

	"github.com/chatcepat/gateway/internal/channel"
	"github.com/chatcepat/gateway/internal/channel/instagram/mock"
	"github.com/chatcepat/gateway/internal/channel/instagram/unofficial"
)

func New(driver string) (channel.Channel, error) {
	switch driver {
	case "mock":
		return mock.New(), nil
	case "unofficial":
		return unofficial.New(), nil
	default:
		return nil, fmt.Errorf("unknown or disabled Instagram driver %q", driver)
	}
}

// NewInstagramChannel is the stable factory entrypoint used by future callers.
func NewInstagramChannel(driver string) (channel.Channel, error) { return New(driver) }
