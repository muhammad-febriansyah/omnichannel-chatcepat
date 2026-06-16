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

	// Adapter per channel type.
	registry := channels.NewRegistry(
		channels.NewTelegram(),
		channels.NewMetaSender(),
		channels.NewWhatsmeowStub(),
	)
	// Channel store: baca tabel channels (read-only) untuk routing + creds.
	// Pakai Postgres kalau DSN ada; fallback in-memory utk dev tanpa DB.
	var store channels.Resolver
	if dsn := env("DATABASE_URL_SYNC", ""); dsn != "" {
		pg, err := channels.NewPgChannelStore(ctx, dsn)
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

	// Outbound worker: consume message.outbound → kirim → publish status.
	ow := &worker.Outbound{Bus: b, Registry: registry, Store: store, Consumer: "gateway-1"}
	go ow.Run(ctx)

	// HTTP: webhook + WS.
	wsHandler := ws.NewHandler(b, env("WS_JWT_SECRET", ""))
	srv := &server.Server{
		Bus:           b,
		Resolver:      store,
		WS:            wsHandler,
		MetaAppSecret: env("META_APP_SECRET", ""),
		MetaVerifyTok: env("META_VERIFY_TOKEN", ""),
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
