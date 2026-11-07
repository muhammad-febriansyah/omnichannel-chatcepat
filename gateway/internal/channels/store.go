package channels

import (
	"context"
	"fmt"
	"sync"

	"github.com/chatcepat/gateway/internal/contracts"
)

// MapChannelStore = store in-memory (dev/test). Produksi: ganti dgn PgChannelStore
// yang baca tabel channels (read-only) untuk type + credentials. Lihat docs/prd/04.
type MapChannelStore struct {
	mu  sync.RWMutex
	m   map[string]ChannelInfo
	ext map[string]string // "<type>:<external_id>" → channel_id
}

func NewMapChannelStore() *MapChannelStore {
	return &MapChannelStore{m: make(map[string]ChannelInfo), ext: make(map[string]string)}
}

func extKey(t contracts.ChannelType, externalID string) string {
	return string(t) + ":" + externalID
}

// Put mendaftarkan channel + index reverse (external_id) untuk webhook.
func (s *MapChannelStore) Put(channelID, externalID string, info ChannelInfo) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[channelID] = info
	if externalID != "" {
		s.ext[extKey(info.Type, externalID)] = channelID
	}
}

// LookupByExternal: phone_number_id/page id → channel_id (untuk webhook Meta).
func (s *MapChannelStore) LookupByExternal(_ context.Context, t contracts.ChannelType, externalID string) (string, ChannelInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cid, ok := s.ext[extKey(t, externalID)]
	if !ok {
		return "", ChannelInfo{}, fmt.Errorf("channel external %s/%s tidak ditemukan", t, externalID)
	}
	return cid, s.m[cid], nil
}

func (s *MapChannelStore) Lookup(_ context.Context, channelID string) (ChannelInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	info, ok := s.m[channelID]
	if !ok {
		return ChannelInfo{}, fmt.Errorf("channel %s tidak ditemukan", channelID)
	}
	return info, nil
}
