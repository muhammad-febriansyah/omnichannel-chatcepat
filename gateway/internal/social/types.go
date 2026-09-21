package social

import "time"

const (
	PlatformFacebook  = "facebook"
	PlatformInstagram = "instagram"

	AccountDisconnected   = "disconnected"
	AccountConnecting     = "connecting"
	AccountConnected      = "connected"
	AccountActionRequired = "action_required"
	AccountPaused         = "paused"
	AccountDisabled       = "disabled"

	JobPending    = "pending"
	JobQueued     = "queued"
	JobProcessing = "processing"
	JobCompleted  = "completed"
	JobFailed     = "failed"
	JobCancelled  = "cancelled"

	ActionComment          = "comment"
	ActionReplyComment     = "reply_comment"
	ActionSendPrivateReply = "send_private_reply"
	ActionReplyMessage     = "reply_message"
	ActionScanComments     = "scan_comments"
	ActionScanMessages     = "scan_messages"

	EventSourceComment = "comment"
	EventSourceMessage = "message"

	EventNew       = "new"
	EventMatched   = "matched"
	EventQueued    = "queued"
	EventProcessed = "processed"
	EventIgnored   = "ignored"
	EventFailed    = "failed"
)

type Account struct {
	ID             string  `json:"id"`
	TenantID       string  `json:"tenant_id"`
	Name           string  `json:"name"`
	Platform       string  `json:"platform"`
	Username       *string `json:"username,omitempty"`
	ExternalUserID *string `json:"external_user_id,omitempty"`
	// ProfilePath is intentionally kept out of API responses. Browser profiles
	// contain sensitive cookies and local browser state.
	ProfilePath       string     `json:"-"`
	Status            string     `json:"status"`
	LastConnectedAt   *time.Time `json:"last_connected_at,omitempty"`
	LastActivityAt    *time.Time `json:"last_activity_at,omitempty"`
	LastError         *string    `json:"last_error,omitempty"`
	LastActionAt      *time.Time `json:"last_action_at,omitempty"`
	LastSuccessAt     *time.Time `json:"last_success_at,omitempty"`
	LastErrorAt       *time.Time `json:"last_error_at,omitempty"`
	LastWarningAt     *time.Time `json:"last_warning_at,omitempty"`
	ConsecutiveErrors int        `json:"consecutive_errors"`
	PausedUntil       *time.Time `json:"paused_until,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

type Job struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenant_id"`
	SocialAccountID string     `json:"social_account_id"`
	Platform        string     `json:"platform"`
	Action          string     `json:"action"`
	TargetURL       string     `json:"target_url"`
	Content         string     `json:"content"`
	SourceEventID   *string    `json:"source_event_id,omitempty"`
	RuleID          *string    `json:"rule_id,omitempty"`
	Status          string     `json:"status"`
	Attempts        int        `json:"attempts"`
	MaxAttempts     int        `json:"max_attempts"`
	ScheduledAt     time.Time  `json:"scheduled_at"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	FailedAt        *time.Time `json:"failed_at,omitempty"`
	ErrorMessage    *string    `json:"error_message,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type IncomingSocialEvent struct {
	ID               string    `json:"id,omitempty"`
	Platform         string    `json:"platform"`
	AccountID        string    `json:"account_id"`
	SourceType       string    `json:"source_type"`
	ExternalID       string    `json:"external_id"`
	ParentExternalID *string   `json:"parent_external_id,omitempty"`
	AuthorExternalID string    `json:"author_external_id"`
	AuthorName       *string   `json:"author_name,omitempty"`
	Content          string    `json:"content"`
	TargetURL        *string   `json:"target_url,omitempty"`
	ReceivedAt       time.Time `json:"received_at"`
	Status           string    `json:"status"`
	MatchedRuleID    *string   `json:"matched_rule_id,omitempty"`
	IsFromSelf       bool      `json:"is_from_self"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type AutoReplyRule struct {
	ID              string            `json:"id,omitempty"`
	SocialAccountID string            `json:"social_account_id"`
	Name            string            `json:"name"`
	Platform        string            `json:"platform"`
	SourceType      string            `json:"source_type"`
	MatchType       string            `json:"match_type"`
	IsActive        bool              `json:"is_active"`
	Priority        int               `json:"priority"`
	Keywords        []string          `json:"keywords"`
	Actions         []AutoReplyAction `json:"actions"`
	CreatedAt       time.Time         `json:"created_at,omitempty"`
	UpdatedAt       time.Time         `json:"updated_at,omitempty"`
}

type AutoReplyAction struct {
	ID         string   `json:"id,omitempty"`
	ActionType string   `json:"action_type"`
	Content    string   `json:"content"`
	SortOrder  int      `json:"sort_order"`
	IsActive   bool     `json:"is_active"`
	Responses  []string `json:"responses,omitempty"`
}

type AutomationSettings struct {
	SocialAccountID            string `json:"social_account_id"`
	AutomationEnabled          bool   `json:"automation_enabled"`
	CommentScannerEnabled      bool   `json:"comment_scanner_enabled"`
	MessageScannerEnabled      bool   `json:"message_scanner_enabled"`
	CommentReplyEnabled        bool   `json:"comment_reply_enabled"`
	CommentPrivateReplyEnabled bool   `json:"comment_private_reply_enabled"`
	MessageReplyEnabled        bool   `json:"message_reply_enabled"`
	ReplyCooldownSeconds       int    `json:"reply_cooldown_seconds"`
	MaxConsecutiveErrors       int    `json:"max_consecutive_errors"`
}

type SocialEventAction struct {
	ID               string     `json:"id"`
	IncomingEventID  string     `json:"incoming_event_id"`
	ActionType       string     `json:"action_type"`
	Status           string     `json:"status"`
	ExternalResultID *string    `json:"external_result_id,omitempty"`
	ExecutedAt       *time.Time `json:"executed_at,omitempty"`
	ErrorMessage     *string    `json:"error_message,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type Activity struct {
	ID              string         `json:"id"`
	SocialAccountID *string        `json:"social_account_id,omitempty"`
	SocialJobID     *string        `json:"social_job_id,omitempty"`
	Event           string         `json:"event"`
	Message         string         `json:"message"`
	Metadata        map[string]any `json:"metadata"`
	CreatedAt       time.Time      `json:"created_at"`
}
