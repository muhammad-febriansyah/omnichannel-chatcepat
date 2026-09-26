package social

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/chatcepat/gateway/internal/queue"
)

func (s *Service) ProcessIncomingEvent(ctx context.Context, event IncomingSocialEvent) error {
	account, err := s.repo.GetAccountByID(ctx, event.AccountID)
	if err != nil {
		return err
	}
	if account.ExternalUserID != nil && event.AuthorExternalID != "" && event.AuthorExternalID == *account.ExternalUserID {
		event.IsFromSelf = true
	}
	if event.IsFromSelf {
		_ = s.repo.SetEventStatus(ctx, event.ID, EventIgnored, nil)
		return s.repo.AddActivity(ctx, account.TenantID, &account.ID, nil, "social_event_ignored", "Own social event ignored", map[string]any{"event_id": event.ID, "reason": "self_event"})
	}
	ignore, err := s.repo.ListIgnoreKeywords(ctx, account.ID)
	if err != nil {
		return err
	}
	if MatchesIgnoreKeyword(event.Content, ignore) {
		_ = s.repo.SetEventStatus(ctx, event.ID, EventIgnored, nil)
		return s.repo.AddActivity(ctx, account.TenantID, &account.ID, nil, "social_event_ignored", "Event matched an ignore keyword", map[string]any{"event_id": event.ID, "reason": "ignore_keyword"})
	}
	rules, err := s.repo.ListRules(ctx, account.TenantID)
	if err != nil {
		return err
	}
	filtered := make([]AutoReplyRule, 0)
	for _, rule := range rules {
		if rule.SocialAccountID == account.ID {
			filtered = append(filtered, rule)
		}
	}
	rule, err := MatchRule(event, filtered)
	if errors.Is(err, ErrRuleNotMatched) {
		_ = s.repo.SetEventStatus(ctx, event.ID, EventIgnored, nil)
		return nil
	}
	if err != nil {
		return err
	}
	if err := s.repo.SetEventStatus(ctx, event.ID, EventMatched, &rule.ID); err != nil {
		return err
	}
	settings, err := s.repo.GetSettings(ctx, account.ID)
	if err != nil {
		return err
	}
	if !settings.AutomationEnabled {
		return s.repo.SetEventStatus(ctx, event.ID, EventIgnored, &rule.ID)
	}
	targetURL := ""
	if event.TargetURL != nil {
		targetURL = *event.TargetURL
	}
	queued := 0
	for _, action := range rule.Actions {
		if !action.IsActive || !actionEnabled(settings, action.ActionType) {
			continue
		}
		content := action.SelectedContent()
		if content == "" {
			continue
		}
		actionID, created, err := s.repo.CreateEventAction(ctx, event, action.ActionType)
		if err != nil {
			return err
		}
		if !created {
			if actionID == "" {
				continue
			}
			// Recover the narrow crash window where the idempotency row was
			// committed but the corresponding job was not created/enqueued.
			var actionStatus string
			actionID, actionStatus, err = s.repo.GetEventAction(ctx, event.ID, action.ActionType)
			if err != nil {
				return err
			}
			if actionStatus != "pending" {
				continue
			}
			existingJob, jobErr := s.repo.GetAutomationJobForEventAction(ctx, event.ID, action.ActionType)
			if jobErr == nil {
				if existingJob.Status == JobPending || existingJob.Status == JobQueued {
					if err := s.queue.EnqueueSocialJob(ctx, queue.SocialJobEnvelope{JobID: existingJob.ID, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}); err != nil {
						return err
					}
					if existingJob.Status == JobPending {
						if err := s.repo.MarkJobQueued(ctx, account.TenantID, existingJob.ID); err != nil {
							return err
						}
					}
					queued++
				}
				continue
			}
			if !errors.Is(jobErr, ErrJobNotFound) {
				return jobErr
			}
		}
		job, err := s.repo.CreateAutomationJob(ctx, account.TenantID, account.ID, account.Platform, action.ActionType, targetURL, content, event.ID, rule.ID, 3)
		if err != nil {
			_ = s.repo.SetEventActionStatus(ctx, actionID, "failed", errorString(err))
			return err
		}
		if err := s.queue.EnqueueSocialJob(ctx, queue.SocialJobEnvelope{JobID: job.ID, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}); err != nil {
			_ = s.repo.SetEventActionStatus(ctx, actionID, "failed", errorString(err))
			_ = s.repo.MarkJobFailed(ctx, job.ID, fmt.Sprintf("queue enqueue failed: %v", err))
			return err
		}
		if err := s.repo.MarkJobQueued(ctx, account.TenantID, job.ID); err != nil {
			return err
		}
		queued++
		_ = s.repo.AddActivity(ctx, account.TenantID, &account.ID, &job.ID, "social_action_queued", "Auto-reply action queued", map[string]any{"event_id": event.ID, "rule_id": rule.ID, "action": action.ActionType})
	}
	if queued > 0 {
		return s.repo.SetEventStatus(ctx, event.ID, EventQueued, &rule.ID)
	}
	return s.repo.SetEventStatus(ctx, event.ID, EventIgnored, &rule.ID)
}

func (s *Service) ProcessScan(ctx context.Context, envelope queue.SocialScanEnvelope) error {
	account, err := s.repo.GetAccountByID(ctx, envelope.AccountID)
	if err != nil {
		return err
	}
	settings, err := s.repo.GetSettings(ctx, account.ID)
	if err != nil {
		return err
	}
	if account.Status != AccountConnected || !settings.AutomationEnabled {
		return nil
	}
	release, err := s.acquireAccountLock(ctx, account.ID, true)
	if err != nil {
		return err
	}
	defer release()
	session, err := s.browser.OpenProfile(ctx, account.Platform, account.ID)
	if err != nil {
		return err
	}
	defer s.browser.CloseProfile(session)
	provider, err := s.providerFactory(account.Platform, session)
	if err != nil {
		return err
	}
	if err := provider.CheckSession(ctx, account); err != nil {
		return s.handleAutomationError(ctx, account, err)
	}
	if settings.CommentScannerEnabled {
		account.CommentPostURLs = settings.CommentPostURLs
		events, err := provider.ScanComments(ctx, account)
		scanErr := err
		for _, event := range events {
			if err := s.saveAndProcessEvent(ctx, account, event); err != nil {
				return err
			}
		}
		if scanErr != nil {
			return s.handleAutomationError(ctx, account, scanErr)
		}
	}
	if settings.MessageScannerEnabled {
		events, err := provider.ScanMessages(ctx, account)
		if err != nil {
			return s.handleAutomationError(ctx, account, err)
		}
		for _, event := range events {
			if err := s.saveAndProcessEvent(ctx, account, event); err != nil {
				return err
			}
		}
	}
	return s.repo.MarkAccountScanSuccess(ctx, account.ID)
}

func (s *Service) saveAndProcessEvent(ctx context.Context, account Account, event IncomingSocialEvent) error {
	event.AccountID = account.ID
	event.Platform = account.Platform
	saved, created, err := s.repo.SaveIncomingEvent(ctx, event)
	if err != nil {
		return err
	}
	if !created && saved.Status != EventNew && saved.Status != EventMatched {
		return nil
	}
	return s.ProcessIncomingEvent(ctx, saved)
}

func (s *Service) processAutomationJob(ctx context.Context, jobID string) error {
	job, err := s.repo.GetJobByID(ctx, jobID)
	if err != nil {
		return err
	}
	if job.Status == JobCancelled || job.Status == JobCompleted || job.Status == JobFailed {
		return nil
	}
	claimed, err := s.repo.MarkJobProcessing(ctx, job.ID)
	if err != nil {
		return err
	}
	if !claimed {
		return nil
	}
	account, err := s.repo.GetAccountByID(ctx, job.SocialAccountID)
	if err != nil {
		_ = s.failJob(ctx, job, err)
		return nil
	}
	if account.PausedUntil != nil && time.Now().UTC().Before(*account.PausedUntil) {
		if err := s.rescheduleJob(ctx, job, *account.PausedUntil, "account pause active"); err != nil {
			_ = s.failJob(ctx, job, err)
		}
		return nil
	}
	if account.Status == AccountActionRequired || account.Status == AccountPaused {
		_ = s.failJob(ctx, job, ErrAccountActionRequired)
		return nil
	}
	if account.Status != AccountConnected {
		_ = s.failJob(ctx, job, ErrAccountNotConnected)
		return nil
	}
	if job.Action == ActionComment {
		_ = s.failJob(ctx, job, ErrAutomationNotReady)
		return nil
	}
	event, err := s.repo.GetIncomingEvent(ctx, valueOrEmpty(job.SourceEventID))
	if err != nil {
		_ = s.failJob(ctx, job, err)
		return nil
	}
	release, err := s.acquireAccountLock(ctx, account.ID, true)
	if err != nil {
		return err
	}
	defer release()
	settings, err := s.repo.GetSettings(ctx, account.ID)
	if err != nil {
		_ = s.failJob(ctx, job, err)
		return nil
	}
	// Settings and rule status can change while a job waits in the queue.
	if !settings.AutomationEnabled || !actionEnabled(settings, job.Action) {
		_ = s.failJob(ctx, job, fmt.Errorf("automation action disabled"))
		return nil
	}
	rule, err := s.repo.GetRule(ctx, account.TenantID, valueOrEmpty(job.RuleID))
	if err != nil || !rule.IsActive {
		_ = s.failJob(ctx, job, fmt.Errorf("automation rule disabled or deleted"))
		return nil
	}
	account, err = s.repo.GetAccountByID(ctx, account.ID)
	if err != nil || account.Status != AccountConnected {
		_ = s.failJob(ctx, job, ErrAccountNotConnected)
		return nil
	}
	cooldown := time.Duration(settings.ReplyCooldownSeconds) * time.Second
	if s.config.AccountMinActionGap > cooldown {
		cooldown = s.config.AccountMinActionGap
	}
	if account.LastActionAt != nil && time.Since(*account.LastActionAt) < cooldown {
		next := account.LastActionAt.Add(cooldown)
		if err := s.rescheduleJob(ctx, job, next, "account cooldown active"); err != nil {
			_ = s.failJob(ctx, job, err)
		}
		return nil
	}
	job.Attempts, err = s.repo.MarkJobAttempt(ctx, job.ID)
	if err != nil {
		return err
	}
	session, err := s.browser.OpenProfile(ctx, account.Platform, account.ID)
	if err != nil {
		_ = s.failJob(ctx, job, err)
		return nil
	}
	defer s.browser.CloseProfile(session)
	provider, err := s.providerFactory(account.Platform, session)
	if err != nil {
		_ = s.failJob(ctx, job, err)
		return nil
	}
	if err := provider.CheckSession(ctx, account); err != nil {
		_ = s.handleAutomationError(ctx, account, err)
		if !isSecurityStop(err) && job.Attempts < job.MaxAttempts {
			_ = s.rescheduleJob(ctx, job, nextBackoff(job.Attempts), err.Error())
		} else {
			_ = s.failJob(ctx, job, err)
		}
		return nil
	}
	if err := s.repo.SetEventActionStatusByEvent(ctx, event.ID, job.Action, "processing", nil); err != nil {
		_ = s.failJob(ctx, job, err)
		return nil
	}
	var actionErr error
	switch job.Action {
	case ActionReplyComment:
		actionErr = provider.ReplyComment(ctx, account, event, job.Content)
	case ActionSendPrivateReply:
		actionErr = provider.SendPrivateReply(ctx, account, event, job.Content)
	case ActionReplyMessage:
		actionErr = provider.ReplyMessage(ctx, account, event, job.Content)
	default:
		actionErr = ErrUnsupportedAction
	}
	if actionErr != nil {
		_ = s.handleAutomationError(ctx, account, actionErr)
		if !isSecurityStop(actionErr) && job.Attempts < job.MaxAttempts {
			_ = s.rescheduleJob(ctx, job, nextBackoff(job.Attempts), actionErr.Error())
		} else {
			_ = s.repo.SetEventActionStatusByEvent(ctx, event.ID, job.Action, "failed", errorString(actionErr))
			_ = s.repo.SetEventStatus(ctx, event.ID, EventFailed, event.MatchedRuleID)
			_ = s.failJob(ctx, job, actionErr)
		}
		return nil
	}
	_ = s.repo.MarkAccountSuccess(ctx, account.ID)
	_ = s.repo.SetEventActionStatusByEvent(ctx, event.ID, job.Action, "completed", nil)
	if openActions, countErr := s.repo.CountOpenEventActions(ctx, event.ID); countErr == nil && openActions == 0 {
		_ = s.repo.SetEventStatus(ctx, event.ID, EventProcessed, event.MatchedRuleID)
	}
	_ = s.repo.MarkJobCompleted(ctx, job.ID)
	_ = s.repo.AddActivity(ctx, account.TenantID, &account.ID, &job.ID, "social_action_completed", "Social automation action completed", map[string]any{"event_id": event.ID, "action": job.Action})
	return nil
}

func (s *Service) ScheduleScans(ctx context.Context) {
	interval := s.config.ScannerInterval
	if interval < 30*time.Second {
		interval = 30 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		accounts, err := s.repo.ListAutomationAccounts(ctx)
		if err == nil {
			for _, account := range accounts {
				_ = s.queue.EnqueueSocialScan(ctx, queue.SocialScanEnvelope{AccountID: account.ID, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)})
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Service) handleAutomationError(ctx context.Context, account Account, cause error) error {
	switch {
	case errors.Is(cause, ErrCaptcha), errors.Is(cause, ErrCheckpoint), errors.Is(cause, ErrSuspiciousLogin), errors.Is(cause, ErrConfirmIdentity), errors.Is(cause, ErrLoginRequired):
		_ = s.repo.MarkAccountWarning(ctx, account.ID, AccountActionRequired, cause.Error(), nil)
	case errors.Is(cause, ErrTemporaryBlock), errors.Is(cause, ErrRateLimited):
		until := time.Now().UTC().Add(30 * time.Minute)
		_ = s.repo.MarkAccountWarning(ctx, account.ID, AccountPaused, cause.Error(), &until)
	case errors.Is(cause, ErrSessionExpired):
		_ = s.repo.SetAccountStatus(ctx, account.TenantID, account.ID, AccountDisconnected, cause.Error())
	default:
		_ = s.repo.MarkAccountError(ctx, account.ID, cause.Error())
		settings, settingsErr := s.repo.GetSettings(ctx, account.ID)
		if settingsErr == nil && account.ConsecutiveErrors+1 >= settings.MaxConsecutiveErrors {
			until := time.Now().UTC().Add(30 * time.Minute)
			_ = s.repo.MarkAccountWarning(ctx, account.ID, AccountPaused, "repeated automation errors", &until)
		}
	}
	return cause
}

func (s *Service) rescheduleJob(ctx context.Context, job Job, scheduledAt time.Time, reason string) error {
	if err := s.repo.RescheduleJob(ctx, job.ID, scheduledAt); err != nil {
		return err
	}
	if err := s.queue.EnqueueSocialJobAt(ctx, queue.SocialJobEnvelope{JobID: job.ID, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)}, scheduledAt); err != nil {
		return err
	}
	_ = s.repo.AddActivity(ctx, job.TenantID, &job.SocialAccountID, &job.ID, "social_action_rescheduled", "Social automation action rescheduled", map[string]any{"reason": reason, "scheduled_at": scheduledAt.UTC().Format(time.RFC3339Nano)})
	return nil
}

func nextBackoff(attempt int) time.Time {
	seconds := 30 * (1 << max(0, attempt-1))
	if seconds > 120 {
		seconds = 120
	}
	return time.Now().UTC().Add(time.Duration(seconds) * time.Second)
}

func isSecurityStop(err error) bool {
	return errors.Is(err, ErrCaptcha) || errors.Is(err, ErrCheckpoint) || errors.Is(err, ErrSuspiciousLogin) || errors.Is(err, ErrConfirmIdentity) || errors.Is(err, ErrLoginRequired) || errors.Is(err, ErrTemporaryBlock) || errors.Is(err, ErrRateLimited) || errors.Is(err, ErrSessionExpired)
}

func actionEnabled(settings AutomationSettings, action string) bool {
	switch action {
	case ActionReplyComment:
		return settings.CommentReplyEnabled
	case ActionSendPrivateReply:
		return settings.CommentPrivateReplyEnabled
	case ActionReplyMessage:
		return settings.MessageReplyEnabled
	default:
		return false
	}
}

func errorString(err error) *string {
	if err == nil {
		return nil
	}
	value := err.Error()
	return &value
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
