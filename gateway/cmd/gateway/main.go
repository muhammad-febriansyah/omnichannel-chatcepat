package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/chatcepat/gateway/internal/channels"
	"github.com/chatcepat/gateway/internal/contracts"
	"github.com/chatcepat/gateway/internal/server"
	"github.com/chatcepat/gateway/internal/worker"
	"github.com/chatcepat/gateway/internal/ws"
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	redisURL := env("REDIS_URL", "redis://localhost:6379/0")

	b, err := bus.New(redisURL)
	if err != nil {
		log.Fatalf("bus: %v", err)
	}
	defer b.Close()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := b.Ping(ctx); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	// Channel store: baca tabel channels (read-only) untuk routing + creds.
	// Pakai Postgres kalau DSN ada; fallback in-memory utk dev tanpa DB.
	dbDSN := env("DATABASE_URL_SYNC", "")
	var store channels.Resolver
	if dbDSN != "" {
		pg, err := channels.NewPgChannelStore(ctx, dbDSN)
		if err != nil {
			log.Printf("PgChannelStore gagal (%v) → fallback MapChannelStore", err)
			store = channels.NewMapChannelStore()
		} else {
			defer pg.Close()
			store = pg
		}
	} else {
		store = channels.NewMapChannelStore()
	}

	// WA unofficial (whatsmeow): sesi device di sqlstore Postgres. dsn kosong → nonaktif.
	wa, err := channels.NewWhatsmeow(ctx, dbDSN, b, store)
	if err != nil {
		log.Printf("whatsmeow init gagal (%v) → WA unofficial nonaktif", err)
		wa = nil
	}
	if wa != nil {
		// Persist status ban/logout durable ke channels.status (tabel milik web) —
		// via endpoint internal web, auth SERVICE_TOKEN yang sama dengan web↔engine.
		// Kosong → deteksi ban tetap jalan (lepas sesi + realtime), cuma tak persist.
		if sink := channels.NewWebStatusSink(env("WEB_INTERNAL_URL", ""), env("SERVICE_TOKEN", "")); sink != nil {
			wa.SetStatusSink(sink)
		}
		defer wa.Close()
		go wa.Restore(ctx) // sambung ulang device tersimpan (non-blocking).
	}

	// Adapter per channel type. api.co.id (provider "apico") melayani WA/IG/FB lewat
	// satu REST gateway — dipilih bila channel.meta.provider = "apico".
	apicoKey := env("APICO_API_KEY", "")
	apicoBase := env("APICO_BASE_URL", "")
	registry := channels.NewRegistry(
		channels.NewTelegram(),
		channels.NewMetaSender(),
		channels.NewMessengerSender(contracts.ChannelTypeFacebook),
		channels.NewMessengerSender(contracts.ChannelTypeInstagram),
		channels.NewApiCoSender(contracts.ChannelTypeWaOfficial, apicoKey, apicoBase),
		channels.NewApiCoSender(contracts.ChannelTypeInstagram, apicoKey, apicoBase),
		channels.NewApiCoSender(contracts.ChannelTypeFacebook, apicoKey, apicoBase),
		wa,
	)

	// Outbound worker: consume message.outbound → kirim → publish status.
	ow := &worker.Outbound{Bus: b, Registry: registry, Store: store, Consumer: "gateway-1"}
	go ow.Run(ctx)

	// HTTP: webhook + WS.
	wsHandler := ws.NewHandler(b, env("WS_JWT_SECRET", ""))
	srv := &server.Server{
		Bus:           b,
		Resolver:      store,
		WS:            wsHandler,
		WA:            wa,
		MetaAppSecret: env("META_APP_SECRET", ""),
		MetaVerifyTok: env("META_VERIFY_TOKEN", ""),
		ApiCoSecret:   env("APICO_WEBHOOK_SECRET", ""),
	}

	httpSrv := &http.Server{Addr: ":8080", Handler: srv.Routes()}
	go func() {
		log.Printf("gateway listening on :8080")
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutCtx)
}
