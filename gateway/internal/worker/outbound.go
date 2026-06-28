// Package worker mengonsumsi message.outbound, kirim lewat adapter, publish status.
package worker

import (
	"context"
	"log"
	"time"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/chatcepat/gateway/internal/channels"
	"github.com/chatcepat/gateway/internal/contracts"
)

type Outbound struct {
	Bus      *bus.Bus
	Registry *channels.Registry
	Store    channels.ChannelStore
	Consumer string
}

const (
	// Retry hanya untuk error transient (jaringan/timeout/5xx/429) — lihat
	// channels.IsTransient. Dibatasi agar worker tak tertahan lama; total tunggu
	// worst-case ≈ 0.5+1+2 = 3.5s sebelum menyerah → status failed.
	maxSendAttempts = 4
	baseSendBackoff = 500 * time.Millisecond
	maxSendBackoff  = 4 * time.Second
)

// RunOnce memproses satu batch outbound. Return jumlah pesan yang diproses.
func (w *Outbound) RunOnce(ctx context.Context, blockMs int) (int, error) {
	msgs, err := w.Bus.ConsumeOutbound(ctx, w.Consumer, 10, blockMs)
	if err != nil {
		return 0, err
	}
	for _, m := range msgs {
		w.process(ctx, m)
		_ = w.Bus.AckOutbound(ctx, m.ID)
	}
	return len(msgs), nil
}

func (w *Outbound) process(ctx context.Context, m bus.OutMsg) {
	cmd := m.Cmd
	if cmd.ChannelId == "" {
		return // pesan rusak, sudah di-ack caller
	}

	st := contracts.MessageStatus{
		IdempotencyKey: cmd.IdempotencyKey,
		Timestamp:      time.Now().UTC(),
	}

	info, err := w.Store.Lookup(ctx, cmd.ChannelId)
	if err != nil {
		w.fail(ctx, st, err)
		return
	}
	adapter, err := w.Registry.GetFor(info.Provider, info.Type)
	if err != nil {
		w.fail(ctx, st, err)
		return
	}

	providerID, err := w.sendWithRetry(ctx, adapter, cmd, info.Credentials)
	if err != nil {
		w.fail(ctx, st, err)
		return
	}

	st.ProviderMessageId = &providerID
	st.Status = contracts.MessageStatusStatusSent
	if _, e := w.Bus.PublishStatus(ctx, &st); e != nil {
		log.Printf("publish status sent gagal: %v", e)
	}
}

// sendWithRetry memanggil adapter.Send dengan retry+backoff eksponensial, tapi
// HANYA untuk error transient (channels.IsTransient: jaringan/timeout/5xx/429).
// Error permanen (4xx/payload invalid) atau adapter yang tak menandai transient
// (mis. whatsmeow, rawan dobel-kirim) langsung dikembalikan tanpa retry.
func (w *Outbound) sendWithRetry(ctx context.Context, adapter channels.Adapter, cmd contracts.OutboundCommand, creds channels.Credentials) (string, error) {
	backoff := baseSendBackoff
	for attempt := 1; ; attempt++ {
		providerID, err := adapter.Send(ctx, cmd, creds)
		if err == nil {
			return providerID, nil
		}
		if attempt >= maxSendAttempts || !channels.IsTransient(err) || ctx.Err() != nil {
			return "", err
		}
		log.Printf("outbound transient (idem=%s, attempt=%d/%d): %v; retry dalam %s",
			cmd.IdempotencyKey, attempt, maxSendAttempts, err, backoff)
		select {
		case <-ctx.Done():
			return "", err
		case <-time.After(backoff):
		}
		if backoff *= 2; backoff > maxSendBackoff {
			backoff = maxSendBackoff
		}
	}
}

func (w *Outbound) fail(ctx context.Context, st contracts.MessageStatus, cause error) {
	msg := cause.Error()
	st.Status = contracts.MessageStatusStatusFailed
	st.Error = &msg
	log.Printf("outbound gagal (idem=%s): %v", st.IdempotencyKey, cause)
	if _, e := w.Bus.PublishStatus(ctx, &st); e != nil {
		log.Printf("publish status failed gagal: %v", e)
	}
}

// Run loop sampai ctx selesai.
func (w *Outbound) Run(ctx context.Context) {
	if err := w.Bus.EnsureGroup(ctx, bus.StreamOutbound, bus.GroupGateway); err != nil {
		log.Printf("ensure group outbound: %v", err)
	}
	for {
		select {
		case <-ctx.Done():
			return
		default:
			if _, err := w.RunOnce(ctx, 5000); err != nil && ctx.Err() == nil {
				log.Printf("outbound worker: %v", err)
				time.Sleep(time.Second)
			}
		}
	}
}
