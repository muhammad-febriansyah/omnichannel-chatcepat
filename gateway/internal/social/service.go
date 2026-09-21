package social

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/chatcepat/gateway/internal/browser"
	"github.com/chatcepat/gateway/internal/queue"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const accountLockTTL = 10 * time.Minute

var releaseLockScript = redis.NewScript(`
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`)

type Service struct {
	repo            *Repository
	pool            *pgxpool.Pool
	rdb             *redis.Client
	queue           *queue.Client
	browser         *browser.Manager
	config          Config
	logger          *slog.Logger
	providerFactory ProviderFactory

	sessionsMu sync.Mutex
	sessions   map[string]*browser.Session
	leases     map[string]func()
}

func New(ctx context.Context, cfg Config) (*Service, error) {
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL_SYNC is required")
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is required")
	}
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("create social pg pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping social db: %w", err)
	}
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("parse social redis: %w", err)
	}
	rdb := redis.NewClient(redisOpts)
	if err := rdb.Ping(ctx).Err(); err != nil {
		pool.Close()
		_ = rdb.Close()
		return nil, fmt.Errorf("ping social redis: %w", err)
	}
	q, err := queue.NewClient(cfg.RedisURL)
	if err != nil {
		pool.Close()
		_ = rdb.Close()
		return nil, err
	}
	return &Service{
		repo: repoFromPool(pool), pool: pool, rdb: rdb, queue: q,
		browser: browser.NewManager(cfg.BrowserStoragePath, cfg.BrowserHeadless, cfg.BrowserNoSandbox),
		config:  cfg, logger: slog.Default(), providerFactory: DefaultProviderFactory,
		sessions: make(map[string]*browser.Session), leases: make(map[string]func()),
	}, nil
}

func repoFromPool(pool *pgxpool.Pool) *Repository { return NewRepository(pool) }

func (s *Service) Close() {
	s.sessionsMu.Lock()
	for id, session := range s.sessions {
		_ = s.browser.CloseProfile(session)
		if release := s.leases[id]; release != nil {
			release()
		}
		delete(s.sessions, id)
		delete(s.leases, id)
	}
	s.sessionsMu.Unlock()
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

func (s *Service) Repository() *Repository { return s.repo }

func (s *Service) SetProviderFactory(factory ProviderFactory) {
	if factory != nil {
		s.providerFactory = factory
	}
}

func (s *Service) CreateAccount(ctx context.Context, tenantID, name, platform string, username *string) (Account, error) {
	platform, err := normalizeAccountInput(name, platform)
	if err != nil {
		return Account{}, err
	}
	accountID := uuid.NewString()
	profile, err := s.browser.Profile(platform, accountID)
	if err != nil {
		return Account{}, err
	}
	if _, err := s.browser.CreateProfile(ctx, platform, accountID); err != nil {
		return Account{}, fmt.Errorf("create browser profile: %w", err)
	}
	account, err := s.repo.CreateAccount(ctx, tenantID, accountID, name, platform, username, profile.Path)
	if err != nil {
		return Account{}, err
	}
	_ = s.repo.AddActivity(ctx, tenantID, &account.ID, nil, "account_created", "Social account created", map[string]any{"platform": platform})
	return account, nil
}

func (s *Service) StartBrowser(ctx context.Context, tenantID, accountID string) (Account, error) {
	account, err := s.repo.GetAccount(ctx, tenantID, accountID)
	if err != nil {
		return Account{}, err
	}
	s.sessionsMu.Lock()
	if _, exists := s.sessions[account.ID]; exists {
		s.sessionsMu.Unlock()
		return account, nil
	}
	s.sessionsMu.Unlock()

	release, err := s.acquireAccountLock(ctx, account.ID, false)
	if err != nil {
		return Account{}, err
	}
	session, err := s.browser.OpenProfile(ctx, account.Platform, account.ID)
	if err != nil {
		release()
		return Account{}, err
	}
	s.sessionsMu.Lock()
	if existing := s.sessions[account.ID]; existing != nil {
		s.sessionsMu.Unlock()
		_ = s.browser.CloseProfile(session)
		release()
		return account, nil
	}
	s.sessions[account.ID] = session
	s.leases[account.ID] = release
	s.sessionsMu.Unlock()

	if err := s.repo.SetAccountStatus(ctx, tenantID, account.ID, AccountConnecting, ""); err != nil {
		_ = s.browser.CloseProfile(session)
		s.sessionsMu.Lock()
		delete(s.sessions, account.ID)
		delete(s.leases, account.ID)
		s.sessionsMu.Unlock()
		release()
		return Account{}, err
	}
	_ = s.repo.AddActivity(ctx, tenantID, &account.ID, nil, "browser_opened", "Chromium opened for manual login", nil)
	account.Status = AccountConnecting
	return account, nil
}

func (s *Service) ValidateSession(ctx context.Context, tenantID, accountID string) (Account, error) {
	account, err := s.repo.GetAccount(ctx, tenantID, accountID)
	if err != nil {
		return Account{}, err
	}

	s.sessionsMu.Lock()
	session := s.sessions[account.ID]
	s.sessionsMu.Unlock()
	ownedSession := false
	var release func()
	if session == nil {
		release, err = s.acquireAccountLock(ctx, account.ID, true)
		if err != nil {
			return Account{}, err
		}
		session, err = s.browser.OpenProfile(ctx, account.Platform, account.ID)
		if err != nil {
			release()
			return Account{}, err
		}
		ownedSession = true
	}
	if ownedSession {
		defer func() {
			_ = s.browser.CloseProfile(session)
			release()
		}()
	}

	provider, err := s.providerFactory(account.Platform, session)
	if err != nil {
		return Account{}, err
	}
	if err := provider.CheckSession(ctx, account); err != nil {
		_ = s.handleAutomationError(ctx, account, err)
		return Account{}, err
	}
	if err := s.repo.SetAccountStatus(ctx, tenantID, account.ID, AccountConnected, ""); err != nil {
		return Account{}, err
	}
	_ = s.repo.AddActivity(ctx, tenantID, &account.ID, nil, "session_connected", "Social session validated after manual login", map[string]any{"platform": account.Platform})
	return s.repo.GetAccount(ctx, tenantID, account.ID)
}

func (s *Service) Disconnect(ctx context.Context, tenantID, accountID string) error {
	account, err := s.repo.GetAccount(ctx, tenantID, accountID)
	if err != nil {
		return err
	}
	s.sessionsMu.Lock()
	session := s.sessions[account.ID]
	release := s.leases[account.ID]
	delete(s.sessions, account.ID)
	delete(s.leases, account.ID)
	s.sessionsMu.Unlock()
	if session != nil {
		_ = s.browser.CloseProfile(session)
	}
	if release != nil {
		release()
	}
	if err := s.repo.SetAccountStatus(ctx, tenantID, account.ID, AccountDisconnected, ""); err != nil {
		return err
	}
	return s.repo.AddActivity(ctx, tenantID, &account.ID, nil, "account_disconnected", "Social account disconnected", nil)
}

func (s *Service) Pause(ctx context.Context, tenantID, accountID string) (Account, error) {
	account, err := s.repo.GetAccount(ctx, tenantID, accountID)
	if err != nil {
		return Account{}, err
	}
	if err := s.repo.SetAccountStatus(ctx, tenantID, account.ID, AccountPaused, ""); err != nil {
		return Account{}, err
	}
	account.Status = AccountPaused
	_ = s.repo.AddActivity(ctx, tenantID, &account.ID, nil, "account_paused", "Social account paused", nil)
	return account, nil
}

func (s *Service) Resume(ctx context.Context, tenantID, accountID string) (Account, error) {
	account, err := s.repo.GetAccount(ctx, tenantID, accountID)
	if err != nil {
		return Account{}, err
	}
	if account.Status == AccountActionRequired {
		return Account{}, ErrAccountActionRequired
	}
	if err := s.repo.SetAccountStatus(ctx, tenantID, account.ID, AccountConnected, ""); err != nil {
		return Account{}, err
	}
	account.Status = AccountConnected
	_ = s.repo.AddActivity(ctx, tenantID, &account.ID, nil, "account_resumed", "Social account resumed", nil)
	return account, nil
}

func (s *Service) CreateCommentJob(ctx context.Context, tenantID, accountID, targetURL, content string, maxAttempts int) (Job, error) {
	account, err := s.repo.GetAccount(ctx, tenantID, accountID)
	if err != nil {
		return Job{}, err
	}
	if account.Status == AccountActionRequired {
		return Job{}, ErrAccountActionRequired
	}
	if account.Status != AccountConnected {
		return Job{}, ErrAccountNotConnected
	}
	if err := validateJobInput(account.Platform, ActionComment, targetURL, content); err != nil {
		return Job{}, err
	}
	job, err := s.repo.CreateJob(ctx, tenantID, account.ID, account.Platform, targetURL, content, maxAttempts)
	if err != nil {
		return Job{}, err
	}
	if err := s.queue.EnqueueSocialJob(ctx, queue.SocialJobEnvelope{JobID: job.ID, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}); err != nil {
		_ = s.repo.MarkJobFailed(ctx, job.ID, fmt.Sprintf("queue enqueue failed: %v", err))
		return Job{}, err
	}
	if err := s.repo.MarkJobQueued(ctx, tenantID, job.ID); err != nil {
		return Job{}, err
	}
	job.Status = JobQueued
	_ = s.repo.AddActivity(ctx, tenantID, &account.ID, &job.ID, "job_queued", "Comment job added to queue", map[string]any{"target_url": targetURL})
	return job, nil
}

func (s *Service) CancelJob(ctx context.Context, tenantID, jobID string) error {
	job, err := s.repo.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return err
	}
	if err := s.repo.CancelJob(ctx, tenantID, job.ID); err != nil {
		return err
	}
	return s.repo.AddActivity(ctx, tenantID, &job.SocialAccountID, &job.ID, "job_cancelled", "Social job cancelled", nil)
}

func (s *Service) ProcessJob(ctx context.Context, envelope queue.SocialJobEnvelope) error {
	return s.processAutomationJob(ctx, envelope.JobID)
}

func (s *Service) failJob(ctx context.Context, job Job, cause error) error {
	if err := s.repo.MarkJobFailed(ctx, job.ID, cause.Error()); err != nil {
		return err
	}
	_ = s.repo.AddActivity(ctx, job.TenantID, &job.SocialAccountID, &job.ID, "job_failed", "Social job failed", map[string]any{"error": cause.Error()})
	return nil
}

func (s *Service) acquireAccountLock(ctx context.Context, accountID string, wait bool) (func(), error) {
	token := uuid.NewString()
	key := "social-account:" + accountID + ":lock"
	for {
		ok, err := s.rdb.SetNX(ctx, key, token, accountLockTTL).Result()
		if err != nil {
			return nil, err
		}
		if ok {
			return func() { _ = releaseLockScript.Run(context.Background(), s.rdb, []string{key}, token).Err() }, nil
		}
		if !wait {
			return nil, ErrAccountBusy
		}
		timer := time.NewTimer(250 * time.Millisecond)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return nil, ctx.Err()
		case <-timer.C:
		}
	}
}

func IsNotFound(err error) bool { return errors.Is(err, ErrAccountNotFound) }
