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

	ActionComment = "comment"
)

type Account struct {
	ID       string  `json:"id"`
	TenantID string  `json:"tenant_id"`
	Name     string  `json:"name"`
	Platform string  `json:"platform"`
	Username *string `json:"username,omitempty"`
	// ProfilePath is intentionally kept out of API responses. Browser profiles
	// contain sensitive cookies and local browser state.
	ProfilePath     string     `json:"-"`
	Status          string     `json:"status"`
	LastConnectedAt *time.Time `json:"last_connected_at,omitempty"`
	LastActivityAt  *time.Time `json:"last_activity_at,omitempty"`
	LastError       *string    `json:"last_error,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type Job struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenant_id"`
	SocialAccountID string     `json:"social_account_id"`
	Platform        string     `json:"platform"`
	Action          string     `json:"action"`
	TargetURL       string     `json:"target_url"`
	Content         string     `json:"content"`
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

type Activity struct {
	ID              string         `json:"id"`
	SocialAccountID *string        `json:"social_account_id,omitempty"`
	SocialJobID     *string        `json:"social_job_id,omitempty"`
	Event           string         `json:"event"`
	Message         string         `json:"message"`
	Metadata        map[string]any `json:"metadata"`
	CreatedAt       time.Time      `json:"created_at"`
}
