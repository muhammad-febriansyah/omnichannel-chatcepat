package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/chatcepat/gateway/internal/queue"
	"github.com/chatcepat/gateway/internal/social"
	"github.com/chatcepat/gateway/internal/socialproviders"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := social.ConfigFromEnv()
	service, err := social.New(ctx, cfg)
	if err != nil {
		log.Fatalf("social scanner init gagal: %v", err)
	}
	defer service.Close()
	service.SetProviderFactory(socialproviders.Factory)
	go service.ScheduleScans(ctx)

	log.Printf("social scanner listening interval=%s", cfg.ScannerInterval)
	if err := queue.RunSocialScanner(cfg.RedisURL, 1, service.ProcessScan); err != nil {
		log.Fatalf("social scanner stopped: %v", err)
	}
}
