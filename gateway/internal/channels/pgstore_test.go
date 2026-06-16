package channels

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/chatcepat/gateway/internal/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func dsn() string {
	if v := os.Getenv("DATABASE_URL_SYNC"); v != "" {
		return v
	}
	return "postgresql://chatcepat:chatcepat@127.0.0.1:5433/chatcepat"
}

func TestPgChannelStore(t *testing.T) {
	ctx := context.Background()
	store, err := NewPgChannelStore(ctx, dsn())
	if err != nil {
		t.Skipf("DB tak tersedia: %v", err)
	}
	defer store.Close()

	pool, err := pgxpool.New(ctx, dsn())
	if err != nil {
		t.Skipf("pool: %v", err)
	}
	defer pool.Close()

	slug := fmt.Sprintf("gw-%d", time.Now().UnixNano())
	ext := fmt.Sprintf("PN-%d", time.Now().UnixNano())

	var tenantID, channelID string
	if err := pool.QueryRow(ctx,
		`INSERT INTO tenants (name, slug) VALUES ('GW Test', $1) RETURNING id::text`, slug,
	).Scan(&tenantID); err != nil {
		t.Fatalf("insert tenant: %v", err)
	}
	if err := pool.QueryRow(ctx,
		`INSERT INTO channels (tenant_id, type, name, status, external_id, credentials)
		 VALUES ($1, 'telegram', 'TG', 'connected', $2, '{"bot_token":"abc123"}'::jsonb)
		 RETURNING id::text`, tenantID, ext,
	).Scan(&channelID); err != nil {
		t.Fatalf("insert channel: %v", err)
	}

	info, err := store.Lookup(ctx, channelID)
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if info.Type != contracts.ChannelTypeTelegram {
		t.Fatalf("type salah: %q", info.Type)
	}
	if info.TenantID != tenantID {
		t.Fatalf("tenant salah: %q vs %q", info.TenantID, tenantID)
	}
	if info.Credentials.String("bot_token") != "abc123" {
		t.Fatalf("creds salah: %v", info.Credentials)
	}

	cid, info2, err := store.LookupByExternal(ctx, contracts.ChannelTypeTelegram, ext)
	if err != nil {
		t.Fatalf("lookup external: %v", err)
	}
	if cid != channelID {
		t.Fatalf("channel id salah: %q vs %q", cid, channelID)
	}
	if info2.Credentials.String("bot_token") != "abc123" {
		t.Fatalf("creds external salah: %v", info2.Credentials)
	}
}
