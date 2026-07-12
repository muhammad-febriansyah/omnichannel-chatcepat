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
	// Provider transport (meta.provider). Kosong = integrasi langsung (Meta/Telegram).
	// "apico" = lewat api.co.id (lihat apico.go).
	Provider string
}

// ChannelStore me-resolve channel_id → tipe + kredensial (read-only dari channels).
type ChannelStore interface {
	Lookup(ctx context.Context, channelID string) (ChannelInfo, error)
}

// Resolver = ChannelStore + reverse lookup by external_id (untuk webhook Meta).
type Resolver interface {
	ChannelStore
	LookupByExternal(ctx context.Context, t contracts.ChannelType, externalID string) (string, ChannelInfo, error)
	// LookupByProvider me-resolve channel tunggal untuk (provider, type) — dipakai webhook
	// api.co.id yang payload-nya tak selalu memuat id akun bisnis. Error bila ambigu/kosong.
	LookupByProvider(ctx context.Context, provider string, t contracts.ChannelType) (string, ChannelInfo, error)
}

// Adapter mengirim pesan keluar lewat satu platform.
type Adapter interface {
	Type() contracts.ChannelType
	Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (providerMessageID string, err error)
}

// ProviderAdapter = Adapter yang melayani transport non-default (mis. api.co.id). Adapter
// yang mengimplement ini didaftarkan terpisah di Registry, dipilih saat channel.Provider cocok.
type ProviderAdapter interface {
	Adapter
	Provider() string
}

// Registry memetakan channel type → adapter. Adapter dengan Provider() didaftarkan ke
// peta per-provider (byProvider[provider][type]); sisanya ke peta default per type.
type Registry struct {
	adapters   map[contracts.ChannelType]Adapter
	byProvider map[string]map[contracts.ChannelType]Adapter
}

func NewRegistry(adapters ...Adapter) *Registry {
	r := &Registry{
		adapters:   make(map[contracts.ChannelType]Adapter),
		byProvider: make(map[string]map[contracts.ChannelType]Adapter),
	}
	for _, a := range adapters {
		if a == nil {
			continue
		}
		if pa, ok := a.(ProviderAdapter); ok && pa.Provider() != "" {
			p := pa.Provider()
			if r.byProvider[p] == nil {
				r.byProvider[p] = make(map[contracts.ChannelType]Adapter)
			}
			r.byProvider[p][a.Type()] = a
			continue
		}
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

// GetFor memilih adapter berdasar provider transport lalu type. provider kosong atau tak
// terdaftar → fallback ke adapter default per type.
func (r *Registry) GetFor(provider string, t contracts.ChannelType) (Adapter, error) {
	if provider != "" {
		if m, ok := r.byProvider[provider]; ok {
			if a, ok := m[t]; ok {
				return a, nil
			}
		}
	}
	return r.Get(t)
}
