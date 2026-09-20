package omnichannel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/automation"
	"github.com/chatcepat/gateway/internal/channel"
	"github.com/chatcepat/gateway/internal/channel/facebook"
	"github.com/chatcepat/gateway/internal/channel/instagram"
	"github.com/chatcepat/gateway/internal/queue"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type automationConditionRow struct {
	Operator string
	Value    string
	Metadata []byte
}

type automationActionRow struct {
	ID        string
	Type      string
	Mode      string
	Config    []byte
	SortOrder int
}

// ProcessAutomationTask is the Asynq worker entrypoint. It normalizes the
// already-persisted comment into generic automation events, evaluates active
// rules, then creates idempotent action runs.
func (s *Service) ProcessAutomationTask(ctx context.Context, task queue.TaskEnvelope) error {
	commentID, _ := task.Payload["comment_id"].(string)
	if commentID == "" {
		return fmt.Errorf("automation task missing comment_id")
	}
	var workspaceID, connectionID, channelType, text, username, postID string
	if err := s.pool.QueryRow(ctx, `SELECT c.workspace_id::text, c.channel_connection_id::text, cc.channel_type, c.text, c.username, c.external_post_id FROM comments c JOIN channel_connections cc ON cc.id=c.channel_connection_id WHERE c.id=$1`, commentID).Scan(&workspaceID, &connectionID, &channelType, &text, &username, &postID); err != nil {
		if isNotFound(err) {
			return nil
		}
		return err
	}

	rows, err := s.pool.Query(ctx, `SELECT id::text, name FROM automation_rules WHERE workspace_id=$1 AND channel_type=$2 AND event_type='comment.created' AND status='active' ORDER BY created_at`, workspaceID, channelType)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var ruleID, ruleName string
		if err := rows.Scan(&ruleID, &ruleName); err != nil {
			return err
		}
		conditions, err := s.conditions(ctx, ruleID)
		if err != nil {
			return err
		}
		if !automation.MatchConditions(text, conditions) {
			continue
		}
		var runID string
		err = s.pool.QueryRow(ctx, `INSERT INTO automation_runs (workspace_id, connection_id, automation_rule_id, comment_id, status) VALUES ($1,$2,$3,$4,'started') ON CONFLICT (automation_rule_id, comment_id) DO NOTHING RETURNING id::text`, workspaceID, connectionID, ruleID, commentID).Scan(&runID)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return err
		}
		s.activity(ctx, workspaceID, connectionID, "automation_triggered", "Automation rule matched an incoming comment", map[string]any{"rule_id": ruleID, "rule_name": ruleName, "comment_id": commentID})
		s.emit(ctx, workspaceID, "automation.started", map[string]any{"run_id": runID, "comment_id": commentID})

		actions, err := s.actions(ctx, ruleID)
		if err != nil {
			return err
		}
		runFailed := false
		for _, action := range actions {
			payload := map[string]any{"comment_id": commentID, "post_id": postID, "username": username, "text": text, "config": json.RawMessage(action.Config)}
			payloadJSON, _ := json.Marshal(payload)
			actionKey := idempotencyKey(runID, action.ID, commentID)
			var actionRunID string
			err := s.pool.QueryRow(ctx, `INSERT INTO channel_action_runs (workspace_id, connection_id, automation_run_id, action_type, idempotency_key, payload, status) VALUES ($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT (idempotency_key) DO NOTHING RETURNING id::text`, workspaceID, connectionID, runID, action.Type, actionKey, payloadJSON).Scan(&actionRunID)
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			if err != nil {
				return err
			}
			if action.Mode == "manual" {
				_, err = s.pool.Exec(ctx, `INSERT INTO pending_actions (workspace_id, channel_action_run_id, action_type, status, payload) VALUES ($1,$2,$3,'pending',$4) ON CONFLICT (channel_action_run_id) DO NOTHING`, workspaceID, actionRunID, action.Type, payloadJSON)
				if err != nil {
					return err
				}
				s.activity(ctx, workspaceID, connectionID, "pending_action.created", "Automation action is waiting for agent approval", map[string]any{"action_run_id": actionRunID, "action_type": action.Type})
				s.emit(ctx, workspaceID, "pending_action.created", map[string]any{"action_run_id": actionRunID, "action_type": action.Type})
				continue
			}
			if err := s.executeAction(ctx, workspaceID, connectionID, actionRunID, action.Type, payload); err != nil {
				runFailed = true
				break
			}
		}
		status := "success"
		if runFailed {
			status = "failed"
		}
		_, _ = s.pool.Exec(ctx, `UPDATE automation_runs SET status=$1, updated_at=now() WHERE id=$2`, status, runID)
		s.emit(ctx, workspaceID, "automation."+status, map[string]any{"run_id": runID, "comment_id": commentID})
	}
	return rows.Err()
}

func (s *Service) conditions(ctx context.Context, ruleID string) ([]automation.Condition, error) {
	rows, err := s.pool.Query(ctx, `SELECT operator, value, metadata FROM automation_conditions WHERE automation_rule_id=$1 ORDER BY sort_order`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var conditions []automation.Condition
	for rows.Next() {
		var row automationConditionRow
		if err := rows.Scan(&row.Operator, &row.Value, &row.Metadata); err != nil {
			return nil, err
		}
		var meta struct {
			CaseSensitive bool `json:"case_sensitive"`
		}
		_ = json.Unmarshal(row.Metadata, &meta)
		conditions = append(conditions, automation.Condition{Operator: row.Operator, Value: row.Value, CaseSensitive: meta.CaseSensitive})
	}
	return conditions, rows.Err()
}

func (s *Service) actions(ctx context.Context, ruleID string) ([]automationActionRow, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text, type, execution_mode, metadata, sort_order FROM automation_actions WHERE automation_rule_id=$1 ORDER BY sort_order`, ruleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var actions []automationActionRow
	for rows.Next() {
		var action automationActionRow
		if err := rows.Scan(&action.ID, &action.Type, &action.Mode, &action.Config, &action.SortOrder); err != nil {
			return nil, err
		}
		actions = append(actions, action)
	}
	return actions, rows.Err()
}

func (s *Service) executeAction(ctx context.Context, workspaceID, connectionID, actionRunID, actionType string, payload map[string]any) error {
	if actionType == "notify_agent" || actionType == "create_contact" {
		_, err := s.pool.Exec(ctx, `UPDATE channel_action_runs SET status='success', attempt=attempt+1, started_at=now(), finished_at=now() WHERE id=$1`, actionRunID)
		if err == nil {
			s.activity(ctx, workspaceID, connectionID, "action_success", "Internal automation action completed", map[string]any{"action_run_id": actionRunID, "action_type": actionType})
		}
		return err
	}
	if actionType == "add_tag" {
		commentID, _ := payload["comment_id"].(string)
		actionConfig := actionConfigFromPayload(payload)
		tag, _ := actionConfig["tag"].(string)
		if tag == "" {
			return s.failAction(ctx, workspaceID, connectionID, actionRunID, fmt.Errorf("add_tag requires config.tag"))
		}
		var contactID string
		if err := s.pool.QueryRow(ctx, `SELECT contact_id::text FROM comments WHERE id=$1`, commentID).Scan(&contactID); err != nil {
			return s.failAction(ctx, workspaceID, connectionID, actionRunID, err)
		}
		_, err := s.pool.Exec(ctx, `UPDATE contacts SET tags=CASE WHEN $1 = ANY(tags) THEN tags ELSE array_append(tags,$1) END, updated_at=now() WHERE id=$2`, tag, contactID)
		if err == nil {
			_, err = s.pool.Exec(ctx, `UPDATE channel_action_runs SET status='success', attempt=attempt+1, started_at=now(), finished_at=now() WHERE id=$1`, actionRunID)
		}
		if err == nil {
			s.activity(ctx, workspaceID, connectionID, "action_success", "Contact tag added", map[string]any{"action_run_id": actionRunID, "tag": tag})
		}
		return err
	}

	row, err := s.connection(ctx, workspaceID, connectionID)
	if err != nil {
		return err
	}
	if err := s.checkAutomationGuard(ctx, row); err != nil {
		return s.failAction(ctx, workspaceID, connectionID, actionRunID, err)
	}
	if row.ChannelType == "instagram" || row.ChannelType == "facebook" {
		if err := s.acquireRateLimit(ctx, row.ChannelType, connectionID); err != nil {
			s.markFailure(ctx, row, err)
			return s.failAction(ctx, workspaceID, connectionID, actionRunID, err)
		}
	}
	driver := s.driver
	if row.ChannelType == "facebook" {
		driver = s.facebookDriver
	}
	if value, ok := row.Metadata["driver"].(string); ok && value != "" {
		driver = value
	}
	var adapter channel.Channel
	if row.ChannelType == "facebook" {
		adapter, err = facebook.New(driver)
	} else {
		adapter, err = instagram.New(driver)
	}
	if err != nil {
		return s.failAction(ctx, workspaceID, connectionID, actionRunID, err)
	}
	_, _ = s.pool.Exec(ctx, `UPDATE channel_action_runs SET status='processing', attempt=attempt+1, started_at=now() WHERE id=$1`, actionRunID)

	var callErr error
	actionConfig := actionConfigFromPayload(payload)
	text, _ := actionConfig["text"].(string)
	if text == "" {
		text = "Terima kasih sudah berkomentar. Tim kami akan segera menghubungi Anda."
	}
	switch actionType {
	case "reply_comment":
		commentID, _ := payload["comment_id"].(string)
		callErr = adapter.ReplyComment(ctx, s.connectionToChannel(row), channel.ReplyCommentRequest{CommentID: commentID, Text: text})
	case "send_message":
		recipient, _ := payload["username"].(string)
		callErr = adapter.SendMessage(ctx, s.connectionToChannel(row), channel.SendMessageRequest{RecipientID: recipient, Text: text})
	default:
		callErr = fmt.Errorf("unsupported automation action %q", actionType)
	}
	if callErr != nil {
		s.markFailure(ctx, row, callErr)
		return s.failAction(ctx, workspaceID, connectionID, actionRunID, callErr)
	}
	s.markSuccess(ctx, row)
	_, err = s.pool.Exec(ctx, `UPDATE channel_action_runs SET status='success', finished_at=now(), error_message=NULL WHERE id=$1`, actionRunID)
	if err == nil {
		s.activity(ctx, workspaceID, connectionID, "action_success", "Channel action completed", map[string]any{"action_run_id": actionRunID, "action_type": actionType})
		s.emit(ctx, workspaceID, "automation.success", map[string]any{"action_run_id": actionRunID, "action_type": actionType})
	}
	return err
}

func actionConfigFromPayload(payload map[string]any) map[string]any {
	var actionConfig map[string]any
	switch value := payload["config"].(type) {
	case map[string]any:
		actionConfig = value
	case json.RawMessage:
		_ = json.Unmarshal(value, &actionConfig)
	case []byte:
		_ = json.Unmarshal(value, &actionConfig)
	}
	if actionConfig == nil {
		actionConfig = map[string]any{}
	}
	return actionConfig
}

func (s *Service) failAction(ctx context.Context, workspaceID, connectionID, actionRunID string, cause error) error {
	_, _ = s.pool.Exec(ctx, `UPDATE channel_action_runs SET status='failed', finished_at=now(), error_message=$1 WHERE id=$2`, cause.Error(), actionRunID)
	s.activity(ctx, workspaceID, connectionID, "action_failed", "Channel action failed", map[string]any{"action_run_id": actionRunID, "error": cause.Error()})
	s.emit(ctx, workspaceID, "automation.failed", map[string]any{"action_run_id": actionRunID, "error": cause.Error()})
	return cause
}

func (s *Service) ApprovePendingAction(ctx context.Context, workspaceID, pendingID string) error {
	var actionRunID, connectionID, actionType string
	var payload []byte
	if err := s.pool.QueryRow(ctx, `SELECT pa.channel_action_run_id::text, ar.connection_id::text, pa.action_type, pa.payload FROM pending_actions pa JOIN channel_action_runs ar ON ar.id=pa.channel_action_run_id WHERE pa.id=$1 AND pa.workspace_id=$2 AND pa.status='pending'`, pendingID, workspaceID).Scan(&actionRunID, &connectionID, &actionType, &payload); err != nil {
		return err
	}
	var data map[string]any
	if err := json.Unmarshal(payload, &data); err != nil {
		return err
	}
	if err := s.executeAction(ctx, workspaceID, connectionID, actionRunID, actionType, data); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `UPDATE pending_actions SET status='approved', reviewed_at=now(), updated_at=now() WHERE id=$1`, pendingID)
	if err == nil {
		s.activity(ctx, workspaceID, connectionID, "action_approved", "Agent approved a pending action", map[string]any{"pending_action_id": pendingID})
	}
	return err
}

func (s *Service) RejectPendingAction(ctx context.Context, workspaceID, pendingID string) error {
	var connectionID string
	err := s.pool.QueryRow(ctx, `SELECT ar.connection_id::text FROM pending_actions pa JOIN channel_action_runs ar ON ar.id=pa.channel_action_run_id WHERE pa.id=$1 AND pa.workspace_id=$2 AND pa.status='pending'`, pendingID, workspaceID).Scan(&connectionID)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE pending_actions SET status='rejected', reviewed_at=now(), updated_at=now() WHERE id=$1`, pendingID)
	if err == nil {
		_, _ = s.pool.Exec(ctx, `UPDATE channel_action_runs SET status='cancelled', finished_at=now(), updated_at=now() WHERE id=(SELECT channel_action_run_id FROM pending_actions WHERE id=$1)`, pendingID)
		s.activity(ctx, workspaceID, connectionID, "action_rejected", "Agent rejected a pending action", map[string]any{"pending_action_id": pendingID})
	}
	return err
}

func (s *Service) NormalizeEvent(commentID string, channelType string, workspaceID, connectionID, contactID, text string) map[string]any {
	return map[string]any{"workspace_id": workspaceID, "connection_id": connectionID, "channel": channelType, "event_type": "comment.created", "contact_id": contactID, "resource_id": commentID, "text": text}
}

func normalizeText(value string) string { return strings.TrimSpace(value) }

var _ = time.Second
var _ = uuid.Nil
