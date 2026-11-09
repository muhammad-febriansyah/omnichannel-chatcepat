// Package worker mengonsumsi message.outbound, kirim lewat adapter, publish status.
package worker

import (
	"context"
	"log"
	"sync"
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
		w.handle(ctx, m)
	}
	return len(msgs), nil
}

// handle sends one message and acks it.
func (w *Outbound) handle(ctx context.Context, m bus.OutMsg) {
	w.process(ctx, m)
	_ = w.Bus.AckOutbound(ctx, m.ID)
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
	adapter, err := w.Registry.Get(info.Type)
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

// Run loop sampai ctx selesai. Tiap channel punya antrian (lane) sendiri: pesan
// dalam satu channel tetap berurutan, tapi jeda "manusiawi" satu akun (WA unofficial
// mengetik, FB/IG dilihat→mengetik) tidak menahan pesan tenant/akun lain.
func (w *Outbound) Run(ctx context.Context) {
	if err := w.Bus.EnsureGroup(ctx, bus.StreamOutbound, bus.GroupGateway); err != nil {
		log.Printf("ensure group outbound: %v", err)
	}
	l := newLanes(ctx, w.handle)
	defer l.wait()
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		if !l.reserve(ctx) {
			return
		}
		msgs, err := w.Bus.ConsumeOutbound(ctx, w.Consumer, 1, 5000)
		if err != nil || len(msgs) == 0 {
			l.release()
			if err != nil && ctx.Err() == nil {
				log.Printf("outbound worker: %v", err)
				time.Sleep(time.Second)
			}
			continue
		}
		l.dispatch(msgs[0])
	}
}

const (
	// maxInFlight = pesan yang sudah dibaca dari stream tapi belum selesai dikirim
	// (semua lane). Juga kapasitas buffer tiap lane, jadi kirim ke lane tak pernah blok.
	maxInFlight = 256
	// laneIdle = lane tanpa pesan selama ini ditutup (goroutine tidak menumpuk).
	laneIdle = time.Minute
)

// lanes = satu goroutine per channel_id, masing-masing memproses pesannya berurutan.
type lanes struct {
	ctx    context.Context
	handle func(context.Context, bus.OutMsg)
	slots  chan struct{} // batas total in-flight

	mu     sync.Mutex
	byChan map[string]chan bus.OutMsg
	wg     sync.WaitGroup
}

func newLanes(ctx context.Context, handle func(context.Context, bus.OutMsg)) *lanes {
	return &lanes{
		ctx:    ctx,
		handle: handle,
		slots:  make(chan struct{}, maxInFlight),
		byChan: make(map[string]chan bus.OutMsg),
	}
}

// reserve menunggu slot in-flight kosong sebelum membaca pesan berikutnya.
func (l *lanes) reserve(ctx context.Context) bool {
	select {
	case l.slots <- struct{}{}:
		return true
	case <-ctx.Done():
		return false
	}
}

func (l *lanes) release() { <-l.slots }

// dispatch memasukkan pesan ke lane channel-nya (dibuat bila belum ada). Kirim ke
// buffer dilakukan di bawah lock supaya lane tidak bisa tutup di antara lookup dan
// kirim; buffer >= maxInFlight jadi tak pernah blok.
func (l *lanes) dispatch(m bus.OutMsg) {
	key := m.Cmd.ChannelId
	l.mu.Lock()
	ch, ok := l.byChan[key]
	if !ok {
		ch = make(chan bus.OutMsg, maxInFlight)
		l.byChan[key] = ch
		l.wg.Add(1)
		go l.run(key, ch)
	}
	ch <- m
	l.mu.Unlock()
}

func (l *lanes) run(key string, ch chan bus.OutMsg) {
	defer l.wg.Done()
	idle := time.NewTimer(laneIdle)
	defer idle.Stop()
	for {
		select {
		case <-l.ctx.Done():
			return
		case m := <-ch:
			l.handle(l.ctx, m)
			l.release()
			if !idle.Stop() {
				select {
				case <-idle.C:
				default:
				}
			}
			idle.Reset(laneIdle)
		case <-idle.C:
			l.mu.Lock()
			if len(ch) == 0 {
				delete(l.byChan, key)
				l.mu.Unlock()
				return
			}
			l.mu.Unlock()
			idle.Reset(laneIdle)
		}
	}
}

// wait menunggu semua lane berhenti (dipanggil saat shutdown).
func (l *lanes) wait() { l.wg.Wait() }
