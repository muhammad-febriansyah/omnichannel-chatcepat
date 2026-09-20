package unofficial

import "github.com/chatcepat/gateway/internal/channel"

func mapHealth(status string) *channel.Health {
	return &channel.Health{Status: status, Message: "Unofficial driver requires an explicit provider implementation"}
}
