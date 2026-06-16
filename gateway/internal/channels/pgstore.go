package channels

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/chatcepat/gateway/internal/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PgChannelStore membaca tabel channels (read-only) untuk routing outbound + webhook.
// Gateway TIDAK menulis tabel domain (docs/prd/01). credentials disimpan terenkripsi
// at-rest — TODO: dekripsi di sini sebelum dipakai adapter.
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

func scanInfo(tenantID, chType string, credsRaw []byte) (ChannelInfo, error) {
	creds := Credentials{}
	if len(credsRaw) > 0 {
		if err := json.Unmarshal(credsRaw, &creds); err != nil {
			return ChannelInfo{}, err
		}
	}
	return ChannelInfo{
		TenantID:    tenantID,
		Type:        contracts.ChannelType(chType),
		Credentials: creds, // TODO: dekripsi
	}, nil
}

func (s *PgChannelStore) Lookup(ctx context.Context, channelID string) (ChannelInfo, error) {
	var tenantID, chType string
	var credsRaw []byte
	err := s.pool.QueryRow(ctx,
		`SELECT tenant_id::text, type::text, credentials FROM channels WHERE id = $1`,
		channelID,
	).Scan(&tenantID, &chType, &credsRaw)
	if err != nil {
		return ChannelInfo{}, fmt.Errorf("channel %s: %w", channelID, err)
	}
	return scanInfo(tenantID, chType, credsRaw)
}

func (s *PgChannelStore) LookupByExternal(ctx context.Context, t contracts.ChannelType, externalID string) (string, ChannelInfo, error) {
	var channelID, tenantID, chType string
	var credsRaw []byte
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, tenant_id::text, type::text, credentials
		   FROM channels WHERE type = $1::channel_type AND external_id = $2`,
		string(t), externalID,
	).Scan(&channelID, &tenantID, &chType, &credsRaw)
	if err != nil {
		return "", ChannelInfo{}, fmt.Errorf("channel %s/%s: %w", t, externalID, err)
	}
	info, err := scanInfo(tenantID, chType, credsRaw)
	return channelID, info, err
}
