package channels

import (
	"sync"

	"go.mau.fi/whatsmeow/types"
)

// readTracker remembers incoming messages not yet marked read, per channel.
//
// Anti-ban: a reply must never arrive before the customer's message shows as read
// (blue ticks) — that is a typical bot tell. Send marks the chat's pending messages
// read first; the delayed "human" read receipt then skips what was already handled.
type readTracker struct {
	mu      sync.Mutex
	pending map[string]map[types.MessageID]types.MessageInfo // channelID → unread
}

func (r *readTracker) add(channelID string, info types.MessageInfo) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.pending == nil {
		r.pending = map[string]map[types.MessageID]types.MessageInfo{}
	}
	m := r.pending[channelID]
	if m == nil {
		m = map[types.MessageID]types.MessageInfo{}
		r.pending[channelID] = m
	}
	// Bounded: a chatty channel that is never answered must not grow forever.
	if len(m) >= 500 {
		for id := range m {
			delete(m, id)
			break
		}
	}
	m[info.ID] = info
}

// take removes one message; ok=false when it was already marked read (or unknown).
func (r *readTracker) take(channelID string, id types.MessageID) (types.MessageInfo, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	info, ok := r.pending[channelID][id]
	if ok {
		delete(r.pending[channelID], id)
	}
	return info, ok
}

// takeChat removes and returns every unread message from this contact. user is the
// recipient's number or LID user part; inbound may carry either (Chat/Sender/SenderAlt).
func (r *readTracker) takeChat(channelID, user string) []types.MessageInfo {
	if user == "" {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []types.MessageInfo
	for id, info := range r.pending[channelID] {
		if info.Chat.User == user || info.Sender.User == user || info.SenderAlt.User == user {
			out = append(out, info)
			delete(r.pending[channelID], id)
		}
	}
	return out
}

// presenceGen counts sends per channel so a delayed "go offline" only fires when no
// newer message started meanwhile (no online/offline flicker between back-to-back
// replies).
type presenceGen struct {
	mu  sync.Mutex
	gen map[string]uint64
}

func (p *presenceGen) bump(channelID string) uint64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.gen == nil {
		p.gen = map[string]uint64{}
	}
	p.gen[channelID]++
	return p.gen[channelID]
}

func (p *presenceGen) current(channelID string) uint64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.gen[channelID]
}
