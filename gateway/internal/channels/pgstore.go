package channels

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/chatcepat/gateway/internal/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgChannelStore membaca tabel channels (read-only) untuk routing outbound + webhook.
// Gateway TIDAK menulis tabel domain (docs/prd/01). credentials terenkripsi at-rest
// (AES-256-GCM) → didekripsi di scanInfo sebelum dipakai adapter.
type PgChannelStore struct {
	pool *pgxpool.Pool
}

func NewPgChannelStore(ctx context.Context, dsn string) (*PgChannelStore, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pgxpool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &PgChannelStore{pool: pool}, nil
}

func (s *PgChannelStore) Close() { s.pool.Close() }

func scanInfo(tenantID, chType string, credsRaw, metaRaw []byte) (ChannelInfo, error) {
	creds := Credentials{}
	if len(credsRaw) > 0 {
		if err := json.Unmarshal(credsRaw, &creds); err != nil {
			return ChannelInfo{}, err
		}
	}
	provider := ""
	if len(metaRaw) > 0 {
		var meta struct {
			Provider string `json:"provider"`
		}
		if err := json.Unmarshal(metaRaw, &meta); err == nil {
			provider = meta.Provider
		}
	}
	return ChannelInfo{
		TenantID:    tenantID,
		Type:        contracts.ChannelType(chType),
		Credentials: decryptCredentials(creds),
		Provider:    provider,
	}, nil
}

func (s *PgChannelStore) Lookup(ctx context.Context, channelID string) (ChannelInfo, error) {
	var tenantID, chType string
	var credsRaw, metaRaw []byte
	err := s.pool.QueryRow(ctx,
		`SELECT tenant_id::text, type::text, credentials, meta FROM channels WHERE id = $1`,
		channelID,
	).Scan(&tenantID, &chType, &credsRaw, &metaRaw)
	if err != nil {
		return ChannelInfo{}, fmt.Errorf("channel %s: %w", channelID, err)
	}
	return scanInfo(tenantID, chType, credsRaw, metaRaw)
}

func (s *PgChannelStore) LookupByExternal(ctx context.Context, t contracts.ChannelType, externalID string) (string, ChannelInfo, error) {
	var channelID, tenantID, chType string
	var credsRaw, metaRaw []byte
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, tenant_id::text, type::text, credentials, meta
		   FROM channels WHERE type = $1::channel_type AND external_id = $2`,
		string(t), externalID,
	).Scan(&channelID, &tenantID, &chType, &credsRaw, &metaRaw)
	if err != nil {
		return "", ChannelInfo{}, fmt.Errorf("channel %s/%s: %w", t, externalID, err)
	}
	info, err := scanInfo(tenantID, chType, credsRaw, metaRaw)
	return channelID, info, err
}

// LookupByProvider me-resolve channel tunggal untuk (provider, type). Error bila tak ada
// atau lebih dari satu (ambigu — webhook tak bisa dipetakan ke channel pasti).
func (s *PgChannelStore) LookupByProvider(ctx context.Context, provider string, t contracts.ChannelType) (string, ChannelInfo, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id::text, tenant_id::text, type::text, credentials, meta
		   FROM channels
		  WHERE type = $1::channel_type AND meta->>'provider' = $2
		  LIMIT 2`,
		string(t), provider,
	)
	if err != nil {
		return "", ChannelInfo{}, fmt.Errorf("channel %s/%s: %w", provider, t, err)
	}
	defer rows.Close()

	var channelID, tenantID, chType string
	var credsRaw, metaRaw []byte
	n := 0
	for rows.Next() {
		if n == 1 {
			return "", ChannelInfo{}, fmt.Errorf("channel %s/%s ambigu: >1 cocok", provider, t)
		}
		if err := rows.Scan(&channelID, &tenantID, &chType, &credsRaw, &metaRaw); err != nil {
			return "", ChannelInfo{}, err
		}
		n++
	}
	if n == 0 {
		return "", ChannelInfo{}, fmt.Errorf("channel %s/%s tidak ditemukan", provider, t)
	}
	info, err := scanInfo(tenantID, chType, credsRaw, metaRaw)
	return channelID, info, err
}
