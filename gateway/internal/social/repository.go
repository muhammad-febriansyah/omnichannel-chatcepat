package social

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func (r *Repository) ResolveTenant(ctx context.Context, requested string) (string, error) {
	if requested != "" {
		if _, err := uuid.Parse(requested); err != nil {
			return "", fmt.Errorf("workspace_id must be UUID")
		}
		return requested, nil
	}
	var id string
	if err := r.pool.QueryRow(ctx, `SELECT id::text FROM tenants ORDER BY created_at LIMIT 1`).Scan(&id); err != nil {
		return "", fmt.Errorf("resolve tenant: %w", err)
	}
	return id, nil
}

func (r *Repository) CreateAccount(ctx context.Context, tenantID, accountID, name, platform string, username *string, profilePath string) (Account, error) {
	var account Account
	err := r.pool.QueryRow(ctx, `
		INSERT INTO social_accounts (id, tenant_id, name, platform, username, profile_path)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::text, tenant_id::text, name, platform, username, external_user_id, profile_path, status,
		          last_connected_at, last_activity_at, last_error, last_action_at, last_success_at,
		          last_error_at, last_warning_at, consecutive_errors, paused_until, created_at, updated_at
	`, accountID, tenantID, name, platform, username, profilePath).Scan(
		&account.ID, &account.TenantID, &account.Name, &account.Platform, &account.Username, &account.ExternalUserID,
		&account.ProfilePath, &account.Status, &account.LastConnectedAt, &account.LastActivityAt,
		&account.LastError, &account.LastActionAt, &account.LastSuccessAt, &account.LastErrorAt,
		&account.LastWarningAt, &account.ConsecutiveErrors, &account.PausedUntil, &account.CreatedAt, &account.UpdatedAt,
	)
	return account, err
}

func (r *Repository) GetAccountByID(ctx context.Context, accountID string) (Account, error) {
	var account Account
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, tenant_id::text, name, platform, username, external_user_id, profile_path, status,
		       last_connected_at, last_activity_at, last_error, last_action_at, last_success_at,
		       last_error_at, last_warning_at, consecutive_errors, paused_until, created_at, updated_at
		FROM social_accounts WHERE id=$1
	`, accountID).Scan(
		&account.ID, &account.TenantID, &account.Name, &account.Platform, &account.Username, &account.ExternalUserID,
		&account.ProfilePath, &account.Status, &account.LastConnectedAt, &account.LastActivityAt,
		&account.LastError, &account.LastActionAt, &account.LastSuccessAt, &account.LastErrorAt,
		&account.LastWarningAt, &account.ConsecutiveErrors, &account.PausedUntil, &account.CreatedAt, &account.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Account{}, ErrAccountNotFound
	}
	return account, err
}

func (r *Repository) ListAccounts(ctx context.Context, tenantID string) ([]Account, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, tenant_id::text, name, platform, username, external_user_id, profile_path, status,
		       last_connected_at, last_activity_at, last_error, last_action_at, last_success_at,
		       last_error_at, last_warning_at, consecutive_errors, paused_until, created_at, updated_at
		FROM social_accounts WHERE tenant_id=$1 ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	accounts := make([]Account, 0)
	for rows.Next() {
		var account Account
		if err := rows.Scan(
			&account.ID, &account.TenantID, &account.Name, &account.Platform, &account.Username, &account.ExternalUserID,
			&account.ProfilePath, &account.Status, &account.LastConnectedAt, &account.LastActivityAt,
			&account.LastError, &account.LastActionAt, &account.LastSuccessAt, &account.LastErrorAt,
			&account.LastWarningAt, &account.ConsecutiveErrors, &account.PausedUntil, &account.CreatedAt, &account.UpdatedAt,
		); err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (r *Repository) GetAccount(ctx context.Context, tenantID, accountID string) (Account, error) {
	var account Account
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, tenant_id::text, name, platform, username, external_user_id, profile_path, status,
		       last_connected_at, last_activity_at, last_error, last_action_at, last_success_at,
		       last_error_at, last_warning_at, consecutive_errors, paused_until, created_at, updated_at
		FROM social_accounts WHERE tenant_id=$1 AND id=$2
	`, tenantID, accountID).Scan(
		&account.ID, &account.TenantID, &account.Name, &account.Platform, &account.Username, &account.ExternalUserID,
		&account.ProfilePath, &account.Status, &account.LastConnectedAt, &account.LastActivityAt,
		&account.LastError, &account.LastActionAt, &account.LastSuccessAt, &account.LastErrorAt,
		&account.LastWarningAt, &account.ConsecutiveErrors, &account.PausedUntil, &account.CreatedAt, &account.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Account{}, ErrAccountNotFound
	}
	return account, err
}

func (r *Repository) SetAccountStatus(ctx context.Context, tenantID, accountID, status, lastError string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE social_accounts SET status=$1, last_error=NULLIF($2, ''),
		last_connected_at=CASE WHEN $1='connected' THEN now() ELSE last_connected_at END,
		paused_until=CASE WHEN $1='connected' THEN NULL ELSE paused_until END,
		updated_at=now() WHERE tenant_id=$3 AND id=$4
	`, status, lastError, tenantID, accountID)
	return err
}

func (r *Repository) SetExternalUserID(ctx context.Context, accountID, externalUserID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_accounts SET external_user_id=NULLIF($1, ''), updated_at=now() WHERE id=$2`, externalUserID, accountID)
	return err
}

func (r *Repository) MarkAccountSuccess(ctx context.Context, accountID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_accounts SET last_success_at=now(), last_action_at=now(), last_activity_at=now(), consecutive_errors=0, last_error=NULL, updated_at=now() WHERE id=$1`, accountID)
	return err
}

func (r *Repository) MarkAccountScanSuccess(ctx context.Context, accountID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_accounts SET last_success_at=now(), last_activity_at=now(), consecutive_errors=0, last_error=NULL, updated_at=now() WHERE id=$1`, accountID)
	return err
}

func (r *Repository) MarkAccountError(ctx context.Context, accountID, message string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_accounts SET last_error=$1, last_error_at=now(), consecutive_errors=consecutive_errors+1, updated_at=now() WHERE id=$2`, message, accountID)
	return err
}

func (r *Repository) MarkAccountWarning(ctx context.Context, accountID, status, message string, pausedUntil *time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_accounts SET status=$1, last_error=NULLIF($2, ''), last_warning_at=now(), paused_until=$3, updated_at=now() WHERE id=$4`, status, message, pausedUntil, accountID)
	return err
}

func (r *Repository) MarkAccountActivity(ctx context.Context, tenantID, accountID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_accounts SET last_activity_at=now(), updated_at=now() WHERE tenant_id=$1 AND id=$2`, tenantID, accountID)
	return err
}

func (r *Repository) CreateJob(ctx context.Context, tenantID, accountID, platform, targetURL, content string, maxAttempts int) (Job, error) {
	var job Job
	if maxAttempts < 1 {
		maxAttempts = 3
	}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO social_jobs (tenant_id, social_account_id, platform, action, target_url, content, max_attempts)
		VALUES ($1, $2, $3, 'comment', $4, $5, $6)
		RETURNING id::text, tenant_id::text, social_account_id::text, platform, action, target_url, content, source_event_id, rule_id,
		          status, attempts, max_attempts, scheduled_at, started_at, completed_at, failed_at,
		          error_message, created_at, updated_at
	`, tenantID, accountID, platform, targetURL, content, maxAttempts).Scan(
		&job.ID, &job.TenantID, &job.SocialAccountID, &job.Platform, &job.Action, &job.TargetURL,
		&job.Content, &job.SourceEventID, &job.RuleID, &job.Status, &job.Attempts, &job.MaxAttempts, &job.ScheduledAt, &job.StartedAt,
		&job.CompletedAt, &job.FailedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)
	return job, err
}

func (r *Repository) ListJobs(ctx context.Context, tenantID string) ([]Job, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, tenant_id::text, social_account_id::text, platform, action, target_url, content, source_event_id, rule_id,
		       status, attempts, max_attempts, scheduled_at, started_at, completed_at, failed_at,
		       error_message, created_at, updated_at
		FROM social_jobs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	jobs := make([]Job, 0)
	for rows.Next() {
		var job Job
		if err := rows.Scan(
			&job.ID, &job.TenantID, &job.SocialAccountID, &job.Platform, &job.Action, &job.TargetURL,
			&job.Content, &job.SourceEventID, &job.RuleID, &job.Status, &job.Attempts, &job.MaxAttempts, &job.ScheduledAt, &job.StartedAt,
			&job.CompletedAt, &job.FailedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
		); err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

func (r *Repository) GetJob(ctx context.Context, tenantID, jobID string) (Job, error) {
	var job Job
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, tenant_id::text, social_account_id::text, platform, action, target_url, content, source_event_id, rule_id,
		       status, attempts, max_attempts, scheduled_at, started_at, completed_at, failed_at,
		       error_message, created_at, updated_at
		FROM social_jobs WHERE tenant_id=$1 AND id=$2
	`, tenantID, jobID).Scan(
		&job.ID, &job.TenantID, &job.SocialAccountID, &job.Platform, &job.Action, &job.TargetURL,
		&job.Content, &job.SourceEventID, &job.RuleID, &job.Status, &job.Attempts, &job.MaxAttempts, &job.ScheduledAt, &job.StartedAt,
		&job.CompletedAt, &job.FailedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, ErrJobNotFound
	}
	return job, err
}

func (r *Repository) GetJobByID(ctx context.Context, jobID string) (Job, error) {
	var job Job
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, tenant_id::text, social_account_id::text, platform, action, target_url, content, source_event_id, rule_id,
		       status, attempts, max_attempts, scheduled_at, started_at, completed_at, failed_at,
		       error_message, created_at, updated_at
		FROM social_jobs WHERE id=$1
	`, jobID).Scan(
		&job.ID, &job.TenantID, &job.SocialAccountID, &job.Platform, &job.Action, &job.TargetURL,
		&job.Content, &job.SourceEventID, &job.RuleID, &job.Status, &job.Attempts, &job.MaxAttempts, &job.ScheduledAt, &job.StartedAt,
		&job.CompletedAt, &job.FailedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, ErrJobNotFound
	}
	return job, err
}

func (r *Repository) MarkJobQueued(ctx context.Context, tenantID, jobID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_jobs SET status='queued', updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status='pending'`, tenantID, jobID)
	return err
}

func (r *Repository) MarkJobProcessing(ctx context.Context, jobID string) (bool, error) {
	result, err := r.pool.Exec(ctx, `UPDATE social_jobs SET status='processing', attempts=attempts+1, started_at=now(), updated_at=now() WHERE id=$1 AND status IN ('pending','queued')`, jobID)
	return result.RowsAffected() == 1, err
}

func (r *Repository) MarkJobCompleted(ctx context.Context, jobID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_jobs SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1`, jobID)
	return err
}

func (r *Repository) MarkJobFailed(ctx context.Context, jobID, message string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_jobs SET status='failed', failed_at=now(), error_message=$2, updated_at=now() WHERE id=$1`, jobID, message)
	return err
}

func (r *Repository) CancelJob(ctx context.Context, tenantID, jobID string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_jobs SET status='cancelled', updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status IN ('pending','queued')`, tenantID, jobID)
	return err
}

func (r *Repository) AddActivity(ctx context.Context, tenantID string, accountID, jobID *string, event, message string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO activity_logs (workspace_id, connection_id, type, description, metadata, social_account_id, social_job_id, event, message)
		VALUES ($1, NULL, $2, $3, $4, $5, $6, $2, $3)
	`, tenantID, event, message, raw, accountID, jobID)
	return err
}

func (r *Repository) ListActivity(ctx context.Context, tenantID, accountID string) ([]Activity, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, social_account_id::text, social_job_id::text,
		       COALESCE(event, type), COALESCE(message, description), metadata, created_at
		FROM activity_logs
		WHERE workspace_id=$1 AND ($2='' OR social_account_id=$2)
		ORDER BY created_at DESC LIMIT 200
	`, tenantID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Activity, 0)
	for rows.Next() {
		var item Activity
		var raw []byte
		if err := rows.Scan(&item.ID, &item.SocialAccountID, &item.SocialJobID, &item.Event, &item.Message, &raw, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.Metadata = map[string]any{}
		if len(raw) > 0 {
			_ = json.Unmarshal(raw, &item.Metadata)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) Stats(ctx context.Context, tenantID string) (map[string]int64, error) {
	var accounts, connected, jobs, pending int64
	err := r.pool.QueryRow(ctx, `
		SELECT
		  (SELECT count(*) FROM social_accounts WHERE tenant_id=$1),
		  (SELECT count(*) FROM social_accounts WHERE tenant_id=$1 AND status='connected'),
		  (SELECT count(*) FROM social_jobs WHERE tenant_id=$1),
		  (SELECT count(*) FROM social_jobs WHERE tenant_id=$1 AND status IN ('pending','queued','processing'))
	`, tenantID).Scan(&accounts, &connected, &jobs, &pending)
	if err != nil {
		return nil, err
	}
	return map[string]int64{"accounts": accounts, "connected_accounts": connected, "jobs": jobs, "active_jobs": pending}, nil
}

func validateTargetURL(platform, raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" || u.Hostname() == "" {
		return ErrInvalidTargetURL
	}
	host := strings.ToLower(u.Hostname())
	if platform == PlatformInstagram && (host == "instagram.com" || strings.HasSuffix(host, ".instagram.com")) {
		return nil
	}
	if platform == PlatformFacebook && (host == "facebook.com" || strings.HasSuffix(host, ".facebook.com")) {
		return nil
	}
	return ErrInvalidTargetURL
}

func normalizeAccountInput(name, platform string) (string, error) {
	name = strings.TrimSpace(name)
	platform = strings.ToLower(strings.TrimSpace(platform))
	if name == "" || len(name) > 120 {
		return "", fmt.Errorf("account name must be between 1 and 120 characters")
	}
	if platform != PlatformFacebook && platform != PlatformInstagram {
		return "", ErrUnsupportedPlatform
	}
	return platform, nil
}

func validateJobInput(platform, action, targetURL, content string) error {
	if action != "" && action != ActionComment {
		return ErrUnsupportedAction
	}
	if err := validateTargetURL(platform, targetURL); err != nil {
		return err
	}
	if strings.TrimSpace(content) == "" {
		return ErrContentRequired
	}
	if len([]rune(content)) > 2000 {
		return fmt.Errorf("comment content must be at most 2000 characters")
	}
	return nil
}
