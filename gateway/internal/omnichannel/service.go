package omnichannel

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/bus"
	"github.com/chatcepat/gateway/internal/channel"
	"github.com/chatcepat/gateway/internal/cryptography"
	"github.com/chatcepat/gateway/internal/queue"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	pool                  *pgxpool.Pool
	rdb                   *redis.Client
	bus                   *bus.Bus
	queue                 *queue.Client
	cipher                *cryptography.SessionCipher
	driver                string
	facebookDriver        string
	ratePerMinute         int64
	facebookRatePerMinute int64
	instagramMinInterval  time.Duration
	facebookMinInterval   time.Duration
	failureLimit          int
	circuitPause          time.Duration
	logger                *slog.Logger
}

type Config struct {
	DatabaseURL                    string
	RedisURL                       string
	SessionEncryptionKey           string
	InstagramDriver                string
	FacebookDriver                 string
	RequestsPerMinute              int64
	FacebookRequestsPerMinute      int64
	InstagramActionIntervalSeconds int
	FacebookActionIntervalSeconds  int
	FailureThreshold               int
	CircuitBreakerMinutes          int
}

func New(ctx context.Context, cfg Config, realtime *bus.Bus) (*Service, error) {
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL_SYNC is required")
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
	}
	if cfg.InstagramDriver == "" {
		cfg.InstagramDriver = "mock"
	}
	if cfg.FacebookDriver == "" {
		cfg.FacebookDriver = "unofficial"
	}
	if cfg.RequestsPerMinute < 1 {
		cfg.RequestsPerMinute = 5
	}
	if cfg.FacebookRequestsPerMinute < 1 {
		cfg.FacebookRequestsPerMinute = 5
	}
	if cfg.InstagramActionIntervalSeconds < 1 {
		cfg.InstagramActionIntervalSeconds = 5
	}
	if cfg.FacebookActionIntervalSeconds < 1 {
		cfg.FacebookActionIntervalSeconds = 5
	}
	if cfg.FailureThreshold < 1 {
		cfg.FailureThreshold = 3
	}
	if cfg.CircuitBreakerMinutes < 1 {
		cfg.CircuitBreakerMinutes = 30
	}

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("create omnichannel pg pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping omnichannel db: %w", err)
	}
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("parse omnichannel redis: %w", err)
	}
	rdb := redis.NewClient(redisOpts)
	if err := rdb.Ping(ctx).Err(); err != nil {
		pool.Close()
		_ = rdb.Close()
		return nil, fmt.Errorf("ping omnichannel redis: %w", err)
	}
	if cfg.SessionEncryptionKey == "" {
		if appEnv := os.Getenv("APP_ENV"); appEnv != "" && appEnv != "development" {
			pool.Close()
			_ = rdb.Close()
			return nil, fmt.Errorf("SESSION_ENCRYPTION_KEY is required outside development")
		}
		cfg.SessionEncryptionKey = "development-only-session-key-change-me"
		slog.Warn("SESSION_ENCRYPTION_KEY missing; using development-only fallback")
	}
	cipher, err := cryptography.NewSessionCipher(cfg.SessionEncryptionKey)
	if err != nil {
		pool.Close()
		_ = rdb.Close()
		return nil, err
	}
	q, err := queue.NewClient(cfg.RedisURL)
	if err != nil {
		pool.Close()
		_ = rdb.Close()
		return nil, err
	}
	return &Service{
		pool: pool, rdb: rdb, bus: realtime, queue: q, cipher: cipher,
		driver: cfg.InstagramDriver, facebookDriver: cfg.FacebookDriver,
		ratePerMinute: cfg.RequestsPerMinute, facebookRatePerMinute: cfg.FacebookRequestsPerMinute,
		instagramMinInterval: time.Duration(cfg.InstagramActionIntervalSeconds) * time.Second,
		facebookMinInterval:  time.Duration(cfg.FacebookActionIntervalSeconds) * time.Second,
		failureLimit:         cfg.FailureThreshold, circuitPause: time.Duration(cfg.CircuitBreakerMinutes) * time.Minute,
		logger: slog.Default(),
	}, nil
}

func (s *Service) Close() {
	if s.queue != nil {
		_ = s.queue.Close()
	}
	if s.rdb != nil {
		_ = s.rdb.Close()
	}
	if s.pool != nil {
		s.pool.Close()
	}
}

func ConfigFromEnv() Config {
	return Config{
		DatabaseURL:                    envFirst("DATABASE_URL_SYNC", "DATABASE_URL"),
		RedisURL:                       envFirst("REDIS_URL", "redis://localhost:6379/0"),
		SessionEncryptionKey:           os.Getenv("SESSION_ENCRYPTION_KEY"),
		InstagramDriver:                envFirst("INSTAGRAM_DRIVER", "mock"),
		FacebookDriver:                 envFirst("FACEBOOK_DRIVER", "unofficial"),
		RequestsPerMinute:              envInt64("INSTAGRAM_REQUESTS_PER_MINUTE", 5),
		FacebookRequestsPerMinute:      envInt64("FACEBOOK_REQUESTS_PER_MINUTE", 5),
		InstagramActionIntervalSeconds: envInt("INSTAGRAM_ACTION_INTERVAL_SECONDS", 5),
		FacebookActionIntervalSeconds:  envInt("FACEBOOK_ACTION_INTERVAL_SECONDS", 5),
		FailureThreshold:               envInt("INSTAGRAM_FAILURE_THRESHOLD", 3),
		CircuitBreakerMinutes:          envInt("INSTAGRAM_CIRCUIT_BREAKER_MINUTES", 30),
	}
}

func envFirst(first, second string) string {
	if value := os.Getenv(first); value != "" {
		return value
	}
	return os.Getenv(second)
}

func envInt(name string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil || value < 1 {
		return fallback
	}
	return value
}

func envInt64(name string, fallback int64) int64 {
	value, err := strconv.ParseInt(os.Getenv(name), 10, 64)
	if err != nil || value < 1 {
		return fallback
	}
	return value
}

func (s *Service) WorkspaceID(ctx context.Context, r *http.Request) (string, error) {
	if value := r.Header.Get("X-Workspace-ID"); value != "" {
		return value, nil
	}
	if value := r.URL.Query().Get("workspace_id"); value != "" {
		return value, nil
	}
	if value := os.Getenv("DEFAULT_WORKSPACE_ID"); value != "" {
		return value, nil
	}
	var id string
	if err := s.pool.QueryRow(ctx, `SELECT id::text FROM tenants ORDER BY created_at LIMIT 1`).Scan(&id); err != nil {
		return "", fmt.Errorf("resolve workspace: %w", err)
	}
	return id, nil
}

func (s *Service) workspaceFromRequest(ctx context.Context, r *http.Request) (string, error) {
	id, err := s.WorkspaceID(ctx, r)
	if err != nil {
		return "", err
	}
	if _, err := uuid.Parse(id); err != nil {
		return "", fmt.Errorf("workspace_id must be UUID")
	}
	return id, nil
}

func (s *Service) emit(ctx context.Context, workspaceID, event string, payload any) {
	if s.bus == nil {
		return
	}
	data, err := json.Marshal(map[string]any{"event": event, "data": payload, "created_at": time.Now().UTC()})
	if err == nil {
		_ = s.bus.PublishRealtime(ctx, workspaceID, data)
	}
}

func (s *Service) activity(ctx context.Context, workspaceID, connectionID, event, description string, metadata map[string]any) {
	metadataJSON, _ := json.Marshal(metadata)
	_, err := s.pool.Exec(ctx, `INSERT INTO activity_logs (workspace_id, connection_id, type, description, metadata) VALUES ($1, NULLIF($2, '')::uuid, $3, $4, $5)`, workspaceID, connectionID, event, description, metadataJSON)
	if err != nil {
		s.logger.Error("activity log failed", "workspace_id", workspaceID, "connection_id", connectionID, "action", event, "error", err)
	}
	s.emit(ctx, workspaceID, event, map[string]any{"connection_id": connectionID, "description": description, "metadata": metadata})
}

func (s *Service) enqueueComment(ctx context.Context, workspaceID, connectionID, commentID string) error {
	key := uuid.NewString()
	return s.queue.EnqueueAutomation(ctx, queue.TaskEnvelope{
		TaskID: key, WorkspaceID: workspaceID, ConnectionID: connectionID,
		Action: "automation.process", Payload: map[string]any{"comment_id": commentID}, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	})
}

type connectionRow struct {
	ID                  string
	WorkspaceID         string
	ChannelType         string
	Name                string
	Status              string
	Metadata            map[string]any
	SessionData         []byte
	AutomationPaused    bool
	ConsecutiveFailures int
	CircuitOpenUntil    *time.Time
}

func (s *Service) connection(ctx context.Context, workspaceID, connectionID string) (connectionRow, error) {
	var row connectionRow
	var metadata []byte
	var session []byte
	var circuit *time.Time
	err := s.pool.QueryRow(ctx, `SELECT id::text, workspace_id::text, channel_type, name, status, metadata, session_data_encrypted, automation_paused, consecutive_failures, circuit_open_until FROM channel_connections WHERE id=$1 AND workspace_id=$2`, connectionID, workspaceID).Scan(&row.ID, &row.WorkspaceID, &row.ChannelType, &row.Name, &row.Status, &metadata, &session, &row.AutomationPaused, &row.ConsecutiveFailures, &circuit)
	if err != nil {
		return row, err
	}
	row.CircuitOpenUntil = circuit
	row.SessionData = session
	row.Metadata = map[string]any{}
	if len(metadata) > 0 {
		_ = json.Unmarshal(metadata, &row.Metadata)
	}
	return row, nil
}

func (s *Service) connectionToChannel(row connectionRow) channel.Connection {
	return channel.Connection{ID: row.ID, WorkspaceID: row.WorkspaceID, ChannelType: row.ChannelType, Name: row.Name, Status: row.Status, Metadata: row.Metadata, SessionData: row.SessionData}
}

func (s *Service) checkAutomationGuard(ctx context.Context, row connectionRow) error {
	if row.Status != "healthy" {
		return fmt.Errorf("automation stopped: account status is %s", row.Status)
	}
	if row.AutomationPaused {
		return fmt.Errorf("automation stopped: account is paused")
	}
	if row.ChannelType == "instagram" {
		var paused bool
		if err := s.pool.QueryRow(ctx, `SELECT COALESCE((settings->>'pause_all_instagram_automations')::boolean, false) FROM tenants WHERE id=$1`, row.WorkspaceID).Scan(&paused); err == nil && paused {
			return fmt.Errorf("automation stopped: global Instagram kill switch is active")
		}
	}
	if row.CircuitOpenUntil != nil && row.CircuitOpenUntil.After(time.Now().UTC()) {
		return fmt.Errorf("automation stopped: circuit breaker open until %s", row.CircuitOpenUntil.UTC().Format(time.RFC3339))
	}
	return nil
}

var accountRateScript = redis.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], 60000) end
if count > tonumber(ARGV[1]) then return -1 end
local now = tonumber(ARGV[2])
local interval = tonumber(ARGV[3])
local next_at = redis.call('GET', KEYS[2])
if next_at and tonumber(next_at) > now then
  redis.call('DECR', KEYS[1])
  return tonumber(next_at) - now
end
redis.call('SET', KEYS[2], now + interval, 'PX', interval * 2 + 1000)
return 0
`)

// acquireRateLimit applies two independent, per-connection safeguards:
// a conservative requests-per-minute window and a minimum interval between
// outbound actions. The Redis script makes the pacing atomic across workers,
// so two accounts do not share a bucket and concurrent jobs for one account
// cannot send at the same time.
func (s *Service) acquireRateLimit(ctx context.Context, channelType, connectionID string) error {
	requestsPerMinute := s.ratePerMinute
	interval := s.instagramMinInterval
	if channelType == "facebook" {
		requestsPerMinute = s.facebookRatePerMinute
		interval = s.facebookMinInterval
	}
	if requestsPerMinute < 1 {
		requestsPerMinute = 1
	}
	if interval < time.Second {
		interval = time.Second
	}

	countKey := "rate:" + channelType + ":" + connectionID
	nextKey := "pace:" + channelType + ":" + connectionID
	for {
		result, err := accountRateScript.Run(ctx, s.rdb, []string{countKey, nextKey}, requestsPerMinute, time.Now().UnixMilli(), interval.Milliseconds()).Int64()
		if err != nil {
			return fmt.Errorf("rate limiter: %w", err)
		}
		if result == -1 {
			return channel.ErrRateLimited
		}
		if result == 0 {
			return nil
		}
		timer := time.NewTimer(time.Duration(result) * time.Millisecond)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return ctx.Err()
		case <-timer.C:
		}
	}
}

func (s *Service) markFailure(ctx context.Context, row connectionRow, cause error) {
	status := "error"
	failures := row.ConsecutiveFailures + 1
	var openUntil any
	if errors.Is(cause, channel.ErrChallengeRequired) {
		status = "challenge_required"
	} else if errors.Is(cause, channel.ErrSessionExpired) {
		status = "session_expired"
	} else if errors.Is(cause, channel.ErrRateLimited) {
		status = "rate_limited"
	} else if failures >= s.failureLimit {
		status = "needs_attention"
		openUntil = time.Now().UTC().Add(s.circuitPause)
	}
	_, err := s.pool.Exec(ctx, `UPDATE channel_connections SET status=$1, consecutive_failures=$2, circuit_open_until=$3, last_error=$4, updated_at=now() WHERE id=$5`, status, failures, openUntil, cause.Error(), row.ID)
	if err != nil {
		s.logger.Error("account failure update failed", "connection_id", row.ID, "action", "health.update", "error", err)
	}
	s.activity(ctx, row.WorkspaceID, row.ID, "account_paused", "Outbound automation paused after channel failure", map[string]any{"status": status, "error": cause.Error()})
}

func (s *Service) markSuccess(ctx context.Context, row connectionRow) {
	_, _ = s.pool.Exec(ctx, `UPDATE channel_connections SET status='healthy', consecutive_failures=0, circuit_open_until=NULL, last_error=NULL, last_successful_request=now(), updated_at=now() WHERE id=$1`, row.ID)
}

func idempotencyKey(parts ...string) string {
	h := sha256.Sum256([]byte(strings.Join(parts, ":")))
	return fmt.Sprintf("%x", h[:])
}

func isNotFound(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
