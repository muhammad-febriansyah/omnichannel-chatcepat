package worker

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/chatcepat/gateway/internal/channels"
	"github.com/chatcepat/gateway/internal/contracts"
)

func redisURL() string {
	if v := os.Getenv("REDIS_URL"); v != "" {
		return v
	}
	return "redis://localhost:6379/0"
}

func TestOutboundWorkerRoundTrip(t *testing.T) {
	ctx := context.Background()
	b, err := bus.New(redisURL())
	if err != nil {
		t.Skipf("bus: %v", err)
	}
	defer b.Close()
	if err := b.Ping(ctx); err != nil {
		t.Skipf("redis tak tersedia: %v", err)
	}
	if err := b.EnsureGroup(ctx, bus.StreamOutbound, bus.GroupGateway); err != nil {
		t.Fatalf("ensure group: %v", err)
	}

	loop := channels.NewLoopback() // Type() = wa_unofficial
	reg := channels.NewRegistry(loop)
	store := channels.NewMapChannelStore()
	store.Put("ch-test", "", channels.ChannelInfo{
		TenantID: "t1", Type: contracts.ChannelTypeWaUnofficial, Credentials: channels.Credentials{},
	})

	idem := fmt.Sprintf("test-%d", time.Now().UnixNano())
	body := "halo dari worker test"
	cmd := contracts.OutboundCommand{
		ChannelId:      "ch-test",
		IdempotencyKey: idem,
		EventId:        "e1",
		ConversationId: "c1",
		To:             contracts.Party{ExternalId: "628999"},
		Type:           contracts.OutboundCommandTypeText,
		Body:           &body,
	}
	if _, err := b.PublishOutbound(ctx, &cmd); err != nil {
		t.Fatalf("publish: %v", err)
	}

	ow := &Outbound{Bus: b, Registry: reg, Store: store, Consumer: "test-" + idem}
	// Drain (mungkin ada backlog dari run lain); berhenti saat pesan kita terkirim.
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := ow.RunOnce(ctx, 1000); err != nil {
			t.Fatalf("runonce: %v", err)
		}
		if sentHas(loop, idem) {
			break
		}
	}

	if !sentHas(loop, idem) {
		t.Fatal("adapter loopback tidak menerima pesan kita")
	}

	// Status sent harus terbit dengan idempotency_key + provider_message_id kita.
	tail, err := b.StatusTail(ctx, 50)
	if err != nil {
		t.Fatalf("status tail: %v", err)
	}
	found := false
	for _, st := range tail {
		if st.IdempotencyKey == idem {
			if st.Status != contracts.MessageStatusStatusSent {
				t.Fatalf("status harus sent, got %q", st.Status)
			}
			if st.ProviderMessageId == nil || *st.ProviderMessageId != "loopback:"+idem {
				t.Fatalf("provider_message_id salah: %+v", st.ProviderMessageId)
			}
			found = true
		}
	}
	if !found {
		t.Fatal("status sent tidak ditemukan di message.status")
	}
}

func sentHas(l *channels.Loopback, idem string) bool {
	for _, c := range l.Sent {
		if c.IdempotencyKey == idem {
			return true
		}
	}
	return false
}
