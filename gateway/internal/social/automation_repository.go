package social

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type RuleInput struct {
	Name       string
	Platform   string
	SourceType string
	MatchType  string
	IsActive   bool
	Priority   int
	Keywords   []string
	Actions    []AutoReplyAction
}

func (r *Repository) ListRules(ctx context.Context, tenantID string) ([]AutoReplyRule, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT ar.id::text, ar.social_account_id::text, ar.name, ar.platform, ar.source_type,
		       ar.match_type, ar.is_active, ar.priority, ar.created_at, ar.updated_at
		FROM auto_reply_rules ar
		JOIN social_accounts sa ON sa.id=ar.social_account_id
		WHERE sa.tenant_id=$1::uuid ORDER BY ar.priority DESC, ar.created_at ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]AutoReplyRule, 0)
	for rows.Next() {
		var rule AutoReplyRule
		if err := rows.Scan(&rule.ID, &rule.SocialAccountID, &rule.Name, &rule.Platform, &rule.SourceType, &rule.MatchType, &rule.IsActive, &rule.Priority, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, err
		}
		if err := r.loadRuleChildren(ctx, &rule); err != nil {
			return nil, err
		}
		result = append(result, rule)
	}
	return result, rows.Err()
}

func (r *Repository) GetRule(ctx context.Context, tenantID, ruleID string) (AutoReplyRule, error) {
	var rule AutoReplyRule
	err := r.pool.QueryRow(ctx, `
		SELECT ar.id::text, ar.social_account_id::text, ar.name, ar.platform, ar.source_type,
		       ar.match_type, ar.is_active, ar.priority, ar.created_at, ar.updated_at
		FROM auto_reply_rules ar
		JOIN social_accounts sa ON sa.id=ar.social_account_id
		WHERE sa.tenant_id=$1::uuid AND ar.id=$2::uuid
	`, tenantID, ruleID).Scan(&rule.ID, &rule.SocialAccountID, &rule.Name, &rule.Platform, &rule.SourceType, &rule.MatchType, &rule.IsActive, &rule.Priority, &rule.CreatedAt, &rule.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return AutoReplyRule{}, ErrRuleNotFound
	}
	if err != nil {
		return AutoReplyRule{}, err
	}
	if err := r.loadRuleChildren(ctx, &rule); err != nil {
		return AutoReplyRule{}, err
	}
	return rule, nil
}

func (r *Repository) loadRuleChildren(ctx context.Context, rule *AutoReplyRule) error {
	keywordRows, err := r.pool.Query(ctx, `SELECT keyword FROM auto_reply_rule_keywords WHERE auto_reply_rule_id=$1::uuid ORDER BY created_at`, rule.ID)
	if err != nil {
		return err
	}
	for keywordRows.Next() {
		var keyword string
		if err := keywordRows.Scan(&keyword); err != nil {
			keywordRows.Close()
			return err
		}
		rule.Keywords = append(rule.Keywords, keyword)
	}
	keywordRows.Close()

	actionRows, err := r.pool.Query(ctx, `
		SELECT id::text, action_type, content, sort_order, is_active
		FROM auto_reply_rule_actions WHERE auto_reply_rule_id=$1::uuid ORDER BY sort_order, created_at
	`, rule.ID)
	if err != nil {
		return err
	}
	for actionRows.Next() {
		var action AutoReplyAction
		if err := actionRows.Scan(&action.ID, &action.ActionType, &action.Content, &action.SortOrder, &action.IsActive); err != nil {
			actionRows.Close()
			return err
		}
		responseRows, err := r.pool.Query(ctx, `SELECT content FROM auto_reply_action_responses WHERE auto_reply_rule_action_id=$1::uuid AND is_active=true ORDER BY created_at`, action.ID)
		if err != nil {
			actionRows.Close()
			return err
		}
		for responseRows.Next() {
			var content string
			if err := responseRows.Scan(&content); err != nil {
				responseRows.Close()
				actionRows.Close()
				return err
			}
			action.Responses = append(action.Responses, content)
		}
		responseRows.Close()
		rule.Actions = append(rule.Actions, action)
	}
	actionRows.Close()
	return actionRows.Err()
}

func (r *Repository) CreateRule(ctx context.Context, tenantID, accountID string, input RuleInput) (AutoReplyRule, error) {
	if err := validateRuleInput(input); err != nil {
		return AutoReplyRule{}, err
	}
	if err := r.validateRuleAccountPlatform(ctx, tenantID, accountID, input.Platform); err != nil {
		return AutoReplyRule{}, err
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return AutoReplyRule{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var rule AutoReplyRule
	err = tx.QueryRow(ctx, `
		INSERT INTO auto_reply_rules (social_account_id, name, platform, source_type, match_type, is_active, priority)
		SELECT id, $3, $4, $5, $6, $7, $8 FROM social_accounts WHERE tenant_id=$1::uuid AND id=$2::uuid
		RETURNING id::text, social_account_id::text, name, platform, source_type, match_type, is_active, priority, created_at, updated_at
	`, tenantID, accountID, input.Name, input.Platform, input.SourceType, input.MatchType, input.IsActive, input.Priority).Scan(
		&rule.ID, &rule.SocialAccountID, &rule.Name, &rule.Platform, &rule.SourceType, &rule.MatchType, &rule.IsActive, &rule.Priority, &rule.CreatedAt, &rule.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return AutoReplyRule{}, ErrAccountNotFound
	}
	if err != nil {
		return AutoReplyRule{}, err
	}
	if err := insertRuleChildren(ctx, tx, rule.ID, input); err != nil {
		return AutoReplyRule{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return AutoReplyRule{}, err
	}
	return r.GetRule(ctx, tenantID, rule.ID)
}

func (r *Repository) UpdateRule(ctx context.Context, tenantID, ruleID string, input RuleInput) (AutoReplyRule, error) {
	if err := validateRuleInput(input); err != nil {
		return AutoReplyRule{}, err
	}
	var accountPlatform string
	err := r.pool.QueryRow(ctx, `
		SELECT sa.platform
		FROM auto_reply_rules ar
		JOIN social_accounts sa ON sa.id=ar.social_account_id
		WHERE sa.tenant_id=$1::uuid AND ar.id=$2::uuid
	`, tenantID, ruleID).Scan(&accountPlatform)
	if errors.Is(err, pgx.ErrNoRows) {
		return AutoReplyRule{}, ErrRuleNotFound
	}
	if err != nil {
		return AutoReplyRule{}, err
	}
	if accountPlatform != input.Platform {
		return AutoReplyRule{}, ErrRulePlatformMismatch
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return AutoReplyRule{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	result, err := tx.Exec(ctx, `
		UPDATE auto_reply_rules ar SET name=$1, platform=$2, source_type=$3, match_type=$4,
		is_active=$5, priority=$6, updated_at=now()
		FROM social_accounts sa WHERE ar.social_account_id=sa.id AND sa.tenant_id=$7::uuid AND ar.id=$8::uuid
	`, input.Name, input.Platform, input.SourceType, input.MatchType, input.IsActive, input.Priority, tenantID, ruleID)
	if err != nil {
		return AutoReplyRule{}, err
	}
	if result.RowsAffected() == 0 {
		return AutoReplyRule{}, ErrRuleNotFound
	}
	if _, err := tx.Exec(ctx, `DELETE FROM auto_reply_rule_keywords WHERE auto_reply_rule_id=$1::uuid`, ruleID); err != nil {
		return AutoReplyRule{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM auto_reply_rule_actions WHERE auto_reply_rule_id=$1::uuid`, ruleID); err != nil {
		return AutoReplyRule{}, err
	}
	if err := insertRuleChildren(ctx, tx, ruleID, input); err != nil {
		return AutoReplyRule{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return AutoReplyRule{}, err
	}
	return r.GetRule(ctx, tenantID, ruleID)
}

func (r *Repository) validateRuleAccountPlatform(ctx context.Context, tenantID, accountID, platform string) error {
	var accountPlatform string
	err := r.pool.QueryRow(ctx, `SELECT platform FROM social_accounts WHERE tenant_id=$1::uuid AND id=$2::uuid`, tenantID, accountID).Scan(&accountPlatform)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrAccountNotFound
	}
	if err != nil {
		return err
	}
	if accountPlatform != platform {
		return ErrRulePlatformMismatch
	}
	return nil
}

func (r *Repository) DeleteRule(ctx context.Context, tenantID, ruleID string) error {
	result, err := r.pool.Exec(ctx, `
		DELETE FROM auto_reply_rules ar USING social_accounts sa
		WHERE ar.social_account_id=sa.id AND sa.tenant_id=$1::uuid AND ar.id=$2::uuid
	`, tenantID, ruleID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrRuleNotFound
	}
	return nil
}

func (r *Repository) SetRuleActive(ctx context.Context, tenantID, ruleID string, active bool) error {
	result, err := r.pool.Exec(ctx, `
		UPDATE auto_reply_rules ar SET is_active=$1, updated_at=now()
		FROM social_accounts sa WHERE ar.social_account_id=sa.id AND sa.tenant_id=$2::uuid AND ar.id=$3::uuid
	`, active, tenantID, ruleID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrRuleNotFound
	}
	return nil
}

func insertRuleChildren(ctx context.Context, tx pgx.Tx, ruleID string, input RuleInput) error {
	for _, keyword := range input.Keywords {
		if _, err := tx.Exec(ctx, `INSERT INTO auto_reply_rule_keywords (auto_reply_rule_id, keyword) VALUES ($1::uuid,$2)`, ruleID, NormalizeContent(keyword)); err != nil {
			return err
		}
	}
	for i, action := range input.Actions {
		sortOrder := action.SortOrder
		if sortOrder == 0 {
			sortOrder = i + 1
		}
		var actionID string
		if err := tx.QueryRow(ctx, `INSERT INTO auto_reply_rule_actions (auto_reply_rule_id, action_type, content, sort_order, is_active) VALUES ($1::uuid,$2,$3,$4,$5) RETURNING id::text`, ruleID, action.ActionType, action.Content, sortOrder, action.IsActive).Scan(&actionID); err != nil {
			return err
		}
		for _, response := range action.Responses {
			if _, err := tx.Exec(ctx, `INSERT INTO auto_reply_action_responses (auto_reply_rule_action_id, content) VALUES ($1::uuid,$2)`, actionID, response); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateRuleInput(input RuleInput) error {
	if input.Name == "" || len([]rune(input.Name)) > 120 {
		return fmt.Errorf("rule name must be between 1 and 120 characters")
	}
	if input.Platform != PlatformFacebook && input.Platform != PlatformInstagram {
		return ErrUnsupportedPlatform
	}
	if input.SourceType != EventSourceComment && input.SourceType != EventSourceMessage {
		return fmt.Errorf("unsupported source type")
	}
	if input.MatchType != "exact" && input.MatchType != "contains" && input.MatchType != "starts_with" {
		return fmt.Errorf("unsupported match type")
	}
	if len(input.Keywords) == 0 {
		return fmt.Errorf("at least one keyword is required")
	}
	if len(input.Actions) == 0 {
		return fmt.Errorf("at least one action is required")
	}
	for _, action := range input.Actions {
		if action.ActionType != ActionReplyComment && action.ActionType != ActionSendPrivateReply && action.ActionType != ActionReplyMessage {
			return ErrUnsupportedAction
		}
		if action.Content == "" && len(action.Responses) == 0 {
			return ErrContentRequired
		}
		if input.SourceType == EventSourceComment && action.ActionType == ActionReplyMessage {
			return fmt.Errorf("reply_message hanya dapat digunakan untuk source message")
		}
		if input.SourceType == EventSourceMessage && (action.ActionType == ActionReplyComment || action.ActionType == ActionSendPrivateReply) {
			return fmt.Errorf("comment action hanya dapat digunakan untuk source comment")
		}
	}
	return nil
}

func (r *Repository) GetSettings(ctx context.Context, accountID string) (AutomationSettings, error) {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO social_account_settings (social_account_id) VALUES ($1::uuid) ON CONFLICT (social_account_id) DO NOTHING
	`, accountID)
	if err != nil {
		return AutomationSettings{}, err
	}
	return r.scanSettings(ctx, accountID)
}

func (r *Repository) scanSettings(ctx context.Context, accountID string) (AutomationSettings, error) {
	var settings AutomationSettings
	err := r.pool.QueryRow(ctx, `
		SELECT social_account_id::text, automation_enabled, comment_scanner_enabled, message_scanner_enabled,
		       comment_reply_enabled, comment_private_reply_enabled, message_reply_enabled,
		       reply_cooldown_seconds, max_consecutive_errors
		FROM social_account_settings WHERE social_account_id=$1::uuid
	`, accountID).Scan(&settings.SocialAccountID, &settings.AutomationEnabled, &settings.CommentScannerEnabled, &settings.MessageScannerEnabled, &settings.CommentReplyEnabled, &settings.CommentPrivateReplyEnabled, &settings.MessageReplyEnabled, &settings.ReplyCooldownSeconds, &settings.MaxConsecutiveErrors)
	return settings, err
}

func (r *Repository) UpdateSettings(ctx context.Context, tenantID, accountID string, settings AutomationSettings) (AutomationSettings, error) {
	result, err := r.pool.Exec(ctx, `
		INSERT INTO social_account_settings (social_account_id, automation_enabled, comment_scanner_enabled,
		message_scanner_enabled, comment_reply_enabled, comment_private_reply_enabled, message_reply_enabled,
		reply_cooldown_seconds, max_consecutive_errors)
		SELECT $2::uuid,$3,$4,$5,$6,$7,$8,GREATEST($9,0),GREATEST($10,1)
		FROM social_accounts WHERE tenant_id=$1::uuid AND id=$2::uuid
		ON CONFLICT (social_account_id) DO UPDATE SET automation_enabled=EXCLUDED.automation_enabled,
		comment_scanner_enabled=EXCLUDED.comment_scanner_enabled,
		message_scanner_enabled=EXCLUDED.message_scanner_enabled,
		comment_reply_enabled=EXCLUDED.comment_reply_enabled,
		comment_private_reply_enabled=EXCLUDED.comment_private_reply_enabled,
		message_reply_enabled=EXCLUDED.message_reply_enabled,
		reply_cooldown_seconds=EXCLUDED.reply_cooldown_seconds,
		max_consecutive_errors=EXCLUDED.max_consecutive_errors, updated_at=now()
	`, tenantID, accountID, settings.AutomationEnabled, settings.CommentScannerEnabled, settings.MessageScannerEnabled, settings.CommentReplyEnabled, settings.CommentPrivateReplyEnabled, settings.MessageReplyEnabled, settings.ReplyCooldownSeconds, settings.MaxConsecutiveErrors)
	if err != nil {
		return AutomationSettings{}, err
	}
	if result.RowsAffected() == 0 {
		return AutomationSettings{}, ErrAccountNotFound
	}
	return r.scanSettings(ctx, accountID)
}

func (r *Repository) ListIgnoreKeywords(ctx context.Context, accountID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT keyword FROM social_account_ignore_keywords WHERE social_account_id=$1::uuid ORDER BY created_at`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keywords []string
	for rows.Next() {
		var keyword string
		if err := rows.Scan(&keyword); err != nil {
			return nil, err
		}
		keywords = append(keywords, keyword)
	}
	return keywords, rows.Err()
}

func (r *Repository) SaveIncomingEvent(ctx context.Context, event IncomingSocialEvent) (IncomingSocialEvent, bool, error) {
	if event.ID == "" {
		event.ID = uuid.NewString()
	}
	if event.ReceivedAt.IsZero() {
		event.ReceivedAt = time.Now().UTC()
	}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO social_incoming_events (id, social_account_id, platform, source_type, external_id,
		parent_external_id, author_external_id, author_name, content, target_url, received_at, status, is_from_self)
		VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,'new',$12)
		ON CONFLICT (platform, social_account_id, external_id) DO NOTHING
		RETURNING id::text, created_at, updated_at
	`, event.ID, event.AccountID, event.Platform, event.SourceType, event.ExternalID, event.ParentExternalID, event.AuthorExternalID, event.AuthorName, event.Content, event.TargetURL, event.ReceivedAt, event.IsFromSelf).Scan(&event.ID, &event.CreatedAt, &event.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		var existing IncomingSocialEvent
		err = r.pool.QueryRow(ctx, `SELECT id::text, social_account_id::text, platform, source_type, external_id, parent_external_id, author_external_id, author_name, content, target_url, received_at, status, matched_rule_id::text, is_from_self, created_at, updated_at FROM social_incoming_events WHERE platform=$1 AND social_account_id=$2::uuid AND external_id=$3`, event.Platform, event.AccountID, event.ExternalID).Scan(&existing.ID, &existing.AccountID, &existing.Platform, &existing.SourceType, &existing.ExternalID, &existing.ParentExternalID, &existing.AuthorExternalID, &existing.AuthorName, &existing.Content, &existing.TargetURL, &existing.ReceivedAt, &existing.Status, &existing.MatchedRuleID, &existing.IsFromSelf, &existing.CreatedAt, &existing.UpdatedAt)
		return existing, false, err
	}
	return event, err == nil, err
}

func (r *Repository) GetIncomingEvent(ctx context.Context, eventID string) (IncomingSocialEvent, error) {
	var event IncomingSocialEvent
	err := r.pool.QueryRow(ctx, `SELECT id::text, social_account_id::text, platform, source_type, external_id, parent_external_id, author_external_id, author_name, content, target_url, received_at, status, matched_rule_id::text, is_from_self, created_at, updated_at FROM social_incoming_events WHERE id=$1::uuid`, eventID).Scan(&event.ID, &event.AccountID, &event.Platform, &event.SourceType, &event.ExternalID, &event.ParentExternalID, &event.AuthorExternalID, &event.AuthorName, &event.Content, &event.TargetURL, &event.ReceivedAt, &event.Status, &event.MatchedRuleID, &event.IsFromSelf, &event.CreatedAt, &event.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return IncomingSocialEvent{}, ErrIncomingEventNotFound
	}
	return event, err
}

func (r *Repository) CreateAutomationJob(ctx context.Context, tenantID, accountID, platform, action, targetURL, content, eventID, ruleID string, maxAttempts int) (Job, error) {
	if maxAttempts < 1 {
		maxAttempts = 3
	}
	var job Job
	err := r.pool.QueryRow(ctx, `
		INSERT INTO social_jobs (tenant_id, social_account_id, platform, action, target_url, content, source_event_id, rule_id, max_attempts)
		VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,NULLIF($7,'')::uuid,NULLIF($8,'')::uuid,$9)
		RETURNING id::text, tenant_id::text, social_account_id::text, platform, action, target_url, content, source_event_id, rule_id,
		          status, attempts, max_attempts, scheduled_at, started_at, completed_at, failed_at,
		          error_message, created_at, updated_at
	`, tenantID, accountID, platform, action, targetURL, content, eventID, ruleID, maxAttempts).Scan(
		&job.ID, &job.TenantID, &job.SocialAccountID, &job.Platform, &job.Action, &job.TargetURL, &job.Content,
		&job.SourceEventID, &job.RuleID, &job.Status, &job.Attempts, &job.MaxAttempts, &job.ScheduledAt,
		&job.StartedAt, &job.CompletedAt, &job.FailedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)
	return job, err
}

func (r *Repository) RescheduleJob(ctx context.Context, jobID string, scheduledAt time.Time) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_jobs SET status='queued', scheduled_at=$1, started_at=NULL, updated_at=now() WHERE id=$2::uuid`, scheduledAt, jobID)
	return err
}

func (r *Repository) SetEventStatus(ctx context.Context, eventID, status string, ruleID *string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_incoming_events SET status=$1, matched_rule_id=$2::uuid, updated_at=now() WHERE id=$3::uuid`, status, ruleID, eventID)
	return err
}

func (r *Repository) CreateEventAction(ctx context.Context, eventID, actionType string) (string, bool, error) {
	var id string
	err := r.pool.QueryRow(ctx, `INSERT INTO social_event_actions (social_incoming_event_id, action_type) VALUES ($1::uuid,$2) ON CONFLICT (social_incoming_event_id, action_type) DO NOTHING RETURNING id::text`, eventID, actionType).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	return id, err == nil, err
}

func (r *Repository) GetEventAction(ctx context.Context, eventID, actionType string) (string, string, error) {
	var id, status string
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, status
		FROM social_event_actions
		WHERE social_incoming_event_id=$1::uuid AND action_type=$2
	`, eventID, actionType).Scan(&id, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrIncomingEventNotFound
	}
	return id, status, err
}

func (r *Repository) GetAutomationJobForEventAction(ctx context.Context, eventID, actionType string) (Job, error) {
	var job Job
	err := r.pool.QueryRow(ctx, `
		SELECT id::text, tenant_id::text, social_account_id::text, platform, action, target_url, content,
		       source_event_id, rule_id, status, attempts, max_attempts, scheduled_at, started_at,
		       completed_at, failed_at, error_message, created_at, updated_at
		FROM social_jobs
		WHERE source_event_id=$1::uuid AND action=$2
		ORDER BY created_at DESC
		LIMIT 1
	`, eventID, actionType).Scan(
		&job.ID, &job.TenantID, &job.SocialAccountID, &job.Platform, &job.Action, &job.TargetURL, &job.Content,
		&job.SourceEventID, &job.RuleID, &job.Status, &job.Attempts, &job.MaxAttempts, &job.ScheduledAt,
		&job.StartedAt, &job.CompletedAt, &job.FailedAt, &job.ErrorMessage, &job.CreatedAt, &job.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Job{}, ErrJobNotFound
	}
	return job, err
}

func (r *Repository) SetEventActionStatus(ctx context.Context, actionID, status string, errMessage *string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_event_actions SET status=$1, executed_at=CASE WHEN $1 IN ('completed','failed') THEN now() ELSE executed_at END, error_message=$2, updated_at=now() WHERE id=$3::uuid`, status, errMessage, actionID)
	return err
}

func (r *Repository) SetEventActionStatusByEvent(ctx context.Context, eventID, actionType, status string, errMessage *string) error {
	_, err := r.pool.Exec(ctx, `UPDATE social_event_actions SET status=$1, executed_at=CASE WHEN $1 IN ('completed','failed') THEN now() ELSE executed_at END, error_message=$2, updated_at=now() WHERE social_incoming_event_id=$3::uuid AND action_type=$4`, status, errMessage, eventID, actionType)
	return err
}

func (r *Repository) CountOpenEventActions(ctx context.Context, eventID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM social_event_actions
		WHERE social_incoming_event_id=$1::uuid AND status IN ('pending','processing')
	`, eventID).Scan(&count)
	return count, err
}

func (r *Repository) ListIncomingEvents(ctx context.Context, tenantID string) ([]IncomingSocialEvent, error) {
	rows, err := r.pool.Query(ctx, `SELECT e.id::text, e.social_account_id::text, e.platform, e.source_type, e.external_id, e.parent_external_id, e.author_external_id, e.author_name, e.content, e.target_url, e.received_at, e.status, e.matched_rule_id::text, e.is_from_self, e.created_at, e.updated_at FROM social_incoming_events e JOIN social_accounts a ON a.id=e.social_account_id WHERE a.tenant_id=$1::uuid ORDER BY e.received_at DESC LIMIT 200`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]IncomingSocialEvent, 0)
	for rows.Next() {
		var event IncomingSocialEvent
		if err := rows.Scan(&event.ID, &event.AccountID, &event.Platform, &event.SourceType, &event.ExternalID, &event.ParentExternalID, &event.AuthorExternalID, &event.AuthorName, &event.Content, &event.TargetURL, &event.ReceivedAt, &event.Status, &event.MatchedRuleID, &event.IsFromSelf, &event.CreatedAt, &event.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}

func (r *Repository) ListAutomationAccounts(ctx context.Context) ([]Account, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT a.id::text, a.tenant_id::text, a.name, a.platform, a.username, a.external_user_id, a.profile_path, a.status,
		       a.last_connected_at, a.last_activity_at, a.last_error, a.last_action_at, a.last_success_at,
		       a.last_error_at, a.last_warning_at, a.consecutive_errors, a.paused_until, a.created_at, a.updated_at
		FROM social_accounts a JOIN social_account_settings s ON s.social_account_id=a.id
		WHERE a.status='connected' AND s.automation_enabled
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	accounts := make([]Account, 0)
	for rows.Next() {
		var account Account
		if err := rows.Scan(&account.ID, &account.TenantID, &account.Name, &account.Platform, &account.Username, &account.ExternalUserID, &account.ProfilePath, &account.Status, &account.LastConnectedAt, &account.LastActivityAt, &account.LastError, &account.LastActionAt, &account.LastSuccessAt, &account.LastErrorAt, &account.LastWarningAt, &account.ConsecutiveErrors, &account.PausedUntil, &account.CreatedAt, &account.UpdatedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}
