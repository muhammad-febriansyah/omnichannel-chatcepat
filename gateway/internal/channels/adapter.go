// Package channels: adapter per channel.type. Menerjemahkan ke/dari format internal
// (contracts.InboundMessage / OutboundCommand). Lihat docs/prd/04.
package channels

import (
	"context"
	"fmt"

	"github.com/chatcepat/gateway/internal/contracts"
)

// Credentials = isi channels.credentials (token, phone_number_id, bot token, dst).
type Credentials map[string]any

func (c Credentials) String(key string) string {
	if v, ok := c[key].(string); ok {
		return v
	}
	return ""
}

// ChannelInfo dipakai router outbound untuk memilih adapter + kredensial.
type ChannelInfo struct {
	TenantID    string
	Type        contracts.ChannelType
	Credentials Credentials
}

// ChannelStore me-resolve channel_id → tipe + kredensial (read-only dari channels).
type ChannelStore interface {
	Lookup(ctx context.Context, channelID string) (ChannelInfo, error)
}

// Resolver = ChannelStore + reverse lookup by external_id (untuk webhook Meta).
type Resolver interface {
	ChannelStore
	LookupByExternal(ctx context.Context, t contracts.ChannelType, externalID string) (string, ChannelInfo, error)
}

// Adapter mengirim pesan keluar lewat satu platform.
type Adapter interface {
	Type() contracts.ChannelType
	Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (providerMessageID string, err error)
}

// Registry memetakan channel type → adapter.
type Registry struct {
	adapters map[contracts.ChannelType]Adapter
}

func NewRegistry(adapters ...Adapter) *Registry {
	r := &Registry{adapters: make(map[contracts.ChannelType]Adapter)}
	for _, a := range adapters {
		r.adapters[a.Type()] = a
	}
	return r
}

func (r *Registry) Get(t contracts.ChannelType) (Adapter, error) {
	a, ok := r.adapters[t]
	if !ok {
		return nil, fmt.Errorf("tidak ada adapter untuk channel type %q", t)
	}
	return a, nil
}
