package channels

import (
	"context"
	"fmt"

	"github.com/chatcepat/gateway/internal/contracts"
)

// WhatsmeowStub — placeholder WA unofficial. Implementasi nyata pakai go.mau.fi/whatsmeow
// (device pairing via QR, session di sqlstore, events.Message handler, client.SendMessage).
// Lihat docs/prd/04. Throttle outbound + deteksi banned saat diimplementasi.
type WhatsmeowStub struct{}

func NewWhatsmeowStub() *WhatsmeowStub { return &WhatsmeowStub{} }

func (w *WhatsmeowStub) Type() contracts.ChannelType { return contracts.ChannelTypeWaUnofficial }

func (w *WhatsmeowStub) Send(context.Context, contracts.OutboundCommand, Credentials) (string, error) {
	return "", fmt.Errorf("whatsmeow belum diimplementasi (TODO 04)")
}
