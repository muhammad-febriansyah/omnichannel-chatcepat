// Package bus membungkus Redis Streams (message.inbound/outbound/status,
// consumer group + ack) dan Pub/Sub realtime. Lihat docs/prd/01, 09.
package bus

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/chatcepat/gateway/internal/contracts"
	"github.com/redis/go-redis/v9"
)

func msDur(ms int) time.Duration { return time.Duration(ms) * time.Millisecond }

const (
	StreamInbound  = "message.inbound"
	StreamOutbound = "message.outbound"
	StreamStatus   = "message.status"
	GroupGateway   = "gateway"
	realtimePrefix = "realtime."
)

type Bus struct {
	rdb *redis.Client
}

func New(redisURL string) (*Bus, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	return &Bus{rdb: redis.NewClient(opt)}, nil
}

func (b *Bus) Ping(ctx context.Context) error { return b.rdb.Ping(ctx).Err() }

func (b *Bus) Close() error { return b.rdb.Close() }

// EnsureGroup membuat consumer group (idempoten — abaikan BUSYGROUP).
func (b *Bus) EnsureGroup(ctx context.Context, stream, group string) error {
	err := b.rdb.XGroupCreateMkStream(ctx, stream, group, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		return err
	}
	return nil
}

func (b *Bus) publish(ctx context.Context, stream string, v any) (string, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return b.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: map[string]any{"data": string(data)},
	}).Result()
}

// PublishInbound: pesan masuk ternormalisasi → engine.
func (b *Bus) PublishInbound(ctx context.Context, msg *contracts.InboundMessage) (string, error) {
	return b.publish(ctx, StreamInbound, msg)
}

// PublishStatus: status pengiriman → engine yang persist.
func (b *Bus) PublishStatus(ctx context.Context, st *contracts.MessageStatus) (string, error) {
	return b.publish(ctx, StreamStatus, st)
}

// PublishOutbound: perintah kirim → stream message.outbound. Normalnya dipublish engine;
// disediakan untuk test / tooling.
func (b *Bus) PublishOutbound(ctx context.Context, cmd *contracts.OutboundCommand) (string, error) {
	return b.publish(ctx, StreamOutbound, cmd)
}

// StatusTail mengembalikan N entri terakhir stream message.status (untuk test/inspeksi).
func (b *Bus) StatusTail(ctx context.Context, n int64) ([]contracts.MessageStatus, error) {
	res, err := b.rdb.XRevRangeN(ctx, StreamStatus, "+", "-", n).Result()
	if err != nil {
		return nil, err
	}
	out := make([]contracts.MessageStatus, 0, len(res))
	for _, m := range res {
		raw, _ := m.Values["data"].(string)
		var st contracts.MessageStatus
		if json.Unmarshal([]byte(raw), &st) == nil {
			out = append(out, st)
		}
	}
	return out, nil
}

// OutMsg = satu perintah kirim dari stream message.outbound.
type OutMsg struct {
	ID  string
	Cmd contracts.OutboundCommand
}

// ConsumeOutbound membaca perintah kirim untuk consumer (group gateway).
func (b *Bus) ConsumeOutbound(ctx context.Context, consumer string, count int64, blockMs int) ([]OutMsg, error) {
	res, err := b.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    GroupGateway,
		Consumer: consumer,
		Streams:  []string{StreamOutbound, ">"},
		Count:    count,
		Block:    msDur(blockMs),
	}).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	var out []OutMsg
	for _, s := range res {
		for _, m := range s.Messages {
			raw, _ := m.Values["data"].(string)
			var cmd contracts.OutboundCommand
			if err := json.Unmarshal([]byte(raw), &cmd); err != nil {
				// skip pesan rusak tapi ack supaya tak loop (ditangani caller via ID)
				out = append(out, OutMsg{ID: m.ID})
				continue
			}
			out = append(out, OutMsg{ID: m.ID, Cmd: cmd})
		}
	}
	return out, nil
}

func (b *Bus) AckOutbound(ctx context.Context, id string) error {
	return b.rdb.XAck(ctx, StreamOutbound, GroupGateway, id).Err()
}

// PublishRealtime: fire-and-forget ke dashboard per tenant.
func (b *Bus) PublishRealtime(ctx context.Context, tenantID string, payload []byte) error {
	return b.rdb.Publish(ctx, realtimePrefix+tenantID, payload).Err()
}

// Subscribe ke realtime.<tenant> (dipakai WS hub).
func (b *Bus) Subscribe(ctx context.Context, tenantID string) *redis.PubSub {
	return b.rdb.Subscribe(ctx, realtimePrefix+tenantID)
}
