package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/chatcepat/gateway/internal/queue"
	"github.com/chatcepat/gateway/internal/social"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := social.ConfigFromEnv()
	service, err := social.New(ctx, cfg)
	if err != nil {
		log.Fatalf("social worker init gagal: %v", err)
	}
	defer service.Close()

	concurrency := 1
	if raw := os.Getenv("SOCIAL_WORKER_CONCURRENCY"); raw != "" {
		if parsed, parseErr := strconv.Atoi(raw); parseErr == nil && parsed > 0 {
			concurrency = parsed
		}
	}
	log.Printf("social worker listening (concurrency=%d)", concurrency)
	if err := queue.RunSocialWorker(cfg.RedisURL, concurrency, service.ProcessJob); err != nil {
		log.Fatalf("social worker stopped: %v", err)
	}
}
