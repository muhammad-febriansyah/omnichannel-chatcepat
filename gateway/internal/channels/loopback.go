package channels

import (
	"context"
	"sync"

	"github.com/chatcepat/gateway/internal/contracts"
)

// Loopback adapter — tidak kirim ke mana-mana, catat saja. Untuk test & dev.
type Loopback struct {
	mu   sync.Mutex
	Sent []contracts.OutboundCommand
}

func NewLoopback() *Loopback { return &Loopback{} }

func (l *Loopback) Type() contracts.ChannelType { return contracts.ChannelTypeWaUnofficial }

func (l *Loopback) Send(_ context.Context, cmd contracts.OutboundCommand, _ Credentials) (string, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.Sent = append(l.Sent, cmd)
	return "loopback:" + cmd.IdempotencyKey, nil
}
