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
	"github.com/chatcepat/gateway/internal/socialproviders"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Switched off: stay idle instead of exiting, so the container doesn't restart-loop.
	if social.AutomationDisabled() {
		log.Printf("social worker disabled: DISABLE_SOCIAL_AUTOMATION is on")
		<-ctx.Done()
		return
	}

	cfg := social.ConfigFromEnv()
	service, err := social.New(ctx, cfg)
	if err != nil {
		log.Fatalf("social worker init gagal: %v", err)
	}
	defer service.Close()
	service.SetProviderFactory(socialproviders.Factory)

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
