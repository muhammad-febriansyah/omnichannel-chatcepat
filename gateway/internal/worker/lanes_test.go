package worker

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/chatcepat/gateway/internal/contracts"
)

func outMsg(id, channel string) bus.OutMsg {
	return bus.OutMsg{ID: id, Cmd: contracts.OutboundCommand{ChannelId: channel}}
}

// A slow channel (human-like typing) must not delay another channel, and messages
// of one channel must keep their order.
func TestLanesParallelAcrossChannelsOrderedWithin(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var mu sync.Mutex
	var order []string
	fastDone := make(chan time.Time, 1)
	handle := func(_ context.Context, m bus.OutMsg) {
		if m.Cmd.ChannelId == "slow" {
			time.Sleep(150 * time.Millisecond)
		} else {
			fastDone <- time.Now()
		}
		mu.Lock()
		order = append(order, m.ID)
		mu.Unlock()
	}

	l := newLanes(ctx, handle)
	start := time.Now()
	for _, m := range []bus.OutMsg{outMsg("s1", "slow"), outMsg("s2", "slow"), outMsg("f1", "fast")} {
		if !l.reserve(ctx) {
			t.Fatal("reserve failed")
		}
		l.dispatch(m)
	}

	select {
	case at := <-fastDone:
		if at.Sub(start) > 100*time.Millisecond {
			t.Fatalf("fast channel waited behind slow channel: %s", at.Sub(start))
		}
	case <-time.After(time.Second):
		t.Fatal("fast channel never processed")
	}

	deadline := time.After(2 * time.Second)
	for {
		mu.Lock()
		n := len(order)
		mu.Unlock()
		if n == 3 {
			break
		}
		select {
		case <-deadline:
			t.Fatalf("only %d messages processed", n)
		case <-time.After(10 * time.Millisecond):
		}
	}

	mu.Lock()
	defer mu.Unlock()
	si1, si2 := -1, -1
	for i, id := range order {
		switch id {
		case "s1":
			si1 = i
		case "s2":
			si2 = i
		}
	}
	if si1 > si2 {
		t.Fatalf("slow channel out of order: %v", order)
	}
	if len(l.slots) != 0 {
		t.Fatalf("in-flight slots not released: %d", len(l.slots))
	}

	cancel()
	l.wait()
}
