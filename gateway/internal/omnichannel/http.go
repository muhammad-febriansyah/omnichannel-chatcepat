package omnichannel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/channel"
	"github.com/chatcepat/gateway/internal/channel/facebook"
	"github.com/chatcepat/gateway/internal/channel/instagram"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/me", s.handleMe)
	mux.HandleFunc("/auth/register", s.handleRegister)
	mux.HandleFunc("/auth/login", s.handleLogin)
	mux.HandleFunc("/dashboard", s.handleDashboard)
	mux.HandleFunc("/channels", s.handleChannels)
	mux.HandleFunc("/channels/", s.handleChannel)
	mux.HandleFunc("/comments", s.handleComments)
	mux.HandleFunc("/contacts", s.handleContacts)
	mux.HandleFunc("/contacts/", s.handleContact)
	mux.HandleFunc("/automations", s.handleAutomations)
	mux.HandleFunc("/automations/", s.handleAutomation)
	mux.HandleFunc("/pending-actions", s.handlePendingActions)
	mux.HandleFunc("/pending-actions/", s.handlePendingAction)
	mux.HandleFunc("/activity", s.handleActivity)
	mux.HandleFunc("/settings/automation", s.handleAutomationKillSwitch)
	mux.HandleFunc("/events", s.handleEvents)
	mux.HandleFunc("/dev/instagram/mock-comment", s.handleMockComment)
	mux.HandleFunc("/dev/instagram/mock-comments", s.handleMockComments)
	mux.HandleFunc("/dev/facebook/mock-comment", s.handleMockFacebookComment)
	mux.HandleFunc("/dev/facebook/mock-comments", s.handleMockFacebookComments)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Workspace-ID")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func (s *Service) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	var body struct {
		Name          string `json:"name"`
		Email         string `json:"email"`
		Password      string `json:"password"`
		WorkspaceName string `json:"workspace_name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if body.Name == "" || body.Email == "" || len(body.Password) < 8 {
		writeError(w, http.StatusBadRequest, fmt.Errorf("name, email, and password of at least 8 characters are required"))
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	workspaceName := body.WorkspaceName
	if workspaceName == "" {
		workspaceName = body.Name + " workspace"
	}
	slug := strings.ToLower(strings.ReplaceAll(body.Email, "@", "-"))
	slug = strings.ReplaceAll(slug, ".", "-")
	slug = slug + "-" + strings.Split(uuid.NewString(), "-")[0]
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer tx.Rollback(r.Context())
	var workspaceID, userID string
	if err = tx.QueryRow(r.Context(), `INSERT INTO tenants (name,slug) VALUES ($1,$2) RETURNING id::text`, workspaceName, slug).Scan(&workspaceID); err != nil {
		writeError(w, http.StatusConflict, err)
		return
	}
	if err = tx.QueryRow(r.Context(), `INSERT INTO users (tenant_id,name,email,password_hash,role,status) VALUES ($1,$2,$3,$4,'client','active') RETURNING id::text`, workspaceID, body.Name, strings.ToLower(body.Email), string(hash)).Scan(&userID); err != nil {
		writeError(w, http.StatusConflict, err)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user_id": userID, "workspace_id": workspaceID, "email": strings.ToLower(body.Email)})
}

func (s *Service) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var userID, workspaceID, name, hash string
	err := s.pool.QueryRow(r.Context(), `SELECT u.id::text, u.tenant_id::text, u.name, u.password_hash FROM users u WHERE lower(u.email)=lower($1) AND u.status='active'`, body.Email).Scan(&userID, &workspaceID, &name, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
		writeError(w, http.StatusUnauthorized, fmt.Errorf("invalid credentials"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user_id": userID, "workspace_id": workspaceID, "name": name})
}

func (s *Service) handleMe(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var name, slug string
	if err := s.pool.QueryRow(r.Context(), `SELECT name, slug FROM tenants WHERE id=$1`, workspaceID).Scan(&name, &slug); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workspace_id": workspaceID, "workspace_name": name, "slug": slug, "role": "admin"})
}

func (s *Service) handleDashboard(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	queries := []string{
		`SELECT count(*) FROM channel_connections WHERE workspace_id=$1`,
		`SELECT count(*) FROM channel_connections WHERE workspace_id=$1 AND channel_type='instagram'`,
		`SELECT count(*) FROM comments WHERE workspace_id=$1 AND created_at >= current_date`,
		`SELECT count(*) FROM contacts WHERE tenant_id=$1 AND created_at >= current_date`,
		`SELECT count(*) FROM automation_runs WHERE workspace_id=$1 AND created_at >= current_date`,
		`SELECT count(*) FROM channel_action_runs WHERE workspace_id=$1 AND status='failed' AND created_at >= current_date`,
		`SELECT count(*) FROM channel_connections WHERE workspace_id=$1 AND status IN ('needs_attention','challenge_required','session_expired','rate_limited')`,
		`SELECT count(*) FROM pending_actions WHERE workspace_id=$1 AND status='pending'`,
	}
	keys := []string{"connected_channels", "instagram_accounts", "comments_today", "new_contacts", "automation_runs", "failed_actions", "accounts_need_attention", "pending_actions"}
	result := make(map[string]any, len(keys))
	for i, query := range queries {
		var count int64
		if err := s.pool.QueryRow(r.Context(), query, workspaceID).Scan(&count); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		result[keys[i]] = count
	}
	writeJSON(w, http.StatusOK, result)
}

type connectRequest struct {
	ChannelType string         `json:"channel_type"`
	Name        string         `json:"name"`
	Username    string         `json:"username"`
	Driver      string         `json:"driver"`
	Credentials map[string]any `json:"credentials"`
	Password    string         `json:"password"`
}

func (s *Service) handleChannels(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		s.listChannels(w, r)
		return
	}
	if r.Method == http.MethodPost && r.URL.Path == "/channels" {
		s.connectChannel(w, r)
		return
	}
	writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
}

func (s *Service) connectChannel(w http.ResponseWriter, r *http.Request) {
	s.connectChannelType(w, r, "instagram")
}

func (s *Service) connectChannelType(w http.ResponseWriter, r *http.Request, channelType string) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var input connectRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	driver := input.Driver
	if driver == "" {
		driver = s.driver
		if channelType == "facebook" {
			driver = s.facebookDriver
		}
	}
	if err := channel.ValidateDriver(driver); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Name == "" {
		input.Name = input.Username
	}
	if input.Name == "" {
		input.Name = strings.Title(channelType) + " account"
	}
	credentials := input.Credentials
	if credentials == nil {
		credentials = map[string]any{}
	}
	// The password can be used by a concrete provider during this request but is
	// never persisted, returned, or logged. The current development provider does
	// not need it.
	delete(credentials, "password")
	delete(credentials, "session")
	delete(credentials, "cookie")
	credentialBytes, _ := json.Marshal(credentials)
	encrypted, err := s.cipher.Encrypt(credentialBytes)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	metadata := map[string]any{"driver": driver, "username": input.Username}
	metadataJSON, _ := json.Marshal(metadata)
	if driver != "mock" && input.Password != "" {
		// Keep the boundary explicit. A future provider can authenticate here
		// without moving credential handling into the core services.
		writeError(w, http.StatusNotImplemented, fmt.Errorf("%s %s login provider is not configured; use manual verification or mock", channelType, driver))
		return
	}
	status := "disconnected"
	if driver == "mock" {
		status = "healthy"
	}
	var id string
	err = s.pool.QueryRow(r.Context(), `INSERT INTO channel_connections (workspace_id, channel_type, name, status, credentials_encrypted, metadata, last_health_check) VALUES ($1,$2,$3,$4,$5,$6,now()) RETURNING id::text`, workspaceID, channelType, input.Name, status, encrypted, metadataJSON).Scan(&id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	s.activity(r.Context(), workspaceID, id, "account_connected", strings.Title(channelType)+" account connected", map[string]any{"driver": driver})
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "workspace_id": workspaceID, "channel_type": channelType, "name": input.Name, "username": input.Username, "status": status, "driver": driver})
}

func (s *Service) listChannels(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rows, err := s.pool.Query(r.Context(), `SELECT id::text, channel_type, name, status, metadata, last_health_check, last_successful_request, last_error, automation_paused, created_at FROM channel_connections WHERE workspace_id=$1 ORDER BY created_at DESC`, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, kind, name, status string
		var metadata []byte
		var health, success, created *time.Time
		var lastError *string
		var paused bool
		if err := rows.Scan(&id, &kind, &name, &status, &metadata, &health, &success, &lastError, &paused, &created); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		var meta map[string]any
		_ = json.Unmarshal(metadata, &meta)
		result = append(result, map[string]any{"id": id, "channel_type": kind, "name": name, "status": status, "metadata": meta, "last_health_check": health, "last_successful_request": success, "last_error": lastError, "automation_paused": paused, "created_at": created})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleChannel(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/channels/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, fmt.Errorf("channel not found"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	id := parts[0]
	if len(parts) == 2 && (parts[0] == "instagram" || parts[0] == "facebook") && parts[1] == "connect" && r.Method == http.MethodPost {
		s.connectChannelType(w, r, parts[0])
		return
	}
	if len(parts) == 2 && parts[1] == "health" && r.Method == http.MethodGet {
		s.healthChannel(w, r, workspaceID, id)
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		_, err := s.pool.Exec(r.Context(), `DELETE FROM channel_connections WHERE id=$1 AND workspace_id=$2`, id, workspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		s.activity(r.Context(), workspaceID, id, "account_disconnected", "Instagram account disconnected", nil)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if len(parts) == 2 && r.Method == http.MethodPost {
		switch parts[1] {
		case "pause":
			s.updateChannelStatus(w, r, workspaceID, id, true)
		case "resume", "reconnect":
			s.updateChannelStatus(w, r, workspaceID, id, false)
		default:
			writeError(w, http.StatusNotFound, fmt.Errorf("channel operation not found"))
		}
		return
	}
	writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
}

func (s *Service) updateChannelStatus(w http.ResponseWriter, r *http.Request, workspaceID, id string, pause bool) {
	status := "healthy"
	if pause {
		status = "disabled"
	}
	_, err := s.pool.Exec(r.Context(), `UPDATE channel_connections SET status=$1, automation_paused=$2, consecutive_failures=0, circuit_open_until=NULL, last_error=NULL, updated_at=now() WHERE id=$3 AND workspace_id=$4`, status, pause, id, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	event, description := "account_resumed", "Instagram automation resumed"
	if pause {
		event, description = "account_paused", "Instagram automation paused"
	}
	s.activity(r.Context(), workspaceID, id, event, description, nil)
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": status, "automation_paused": pause})
}

func (s *Service) healthChannel(w http.ResponseWriter, r *http.Request, workspaceID, id string) {
	row, err := s.connection(r.Context(), workspaceID, id)
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
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
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	health, healthErr := adapter.HealthCheck(r.Context(), s.connectionToChannel(row))
	status := "healthy"
	if healthErr != nil || health == nil || health.Status != "healthy" {
		status = "needs_attention"
		if health != nil && health.Status != "" {
			status = health.Status
		}
	}
	_, _ = s.pool.Exec(r.Context(), `UPDATE channel_connections SET status=$1, last_health_check=now(), last_error=$2, updated_at=now() WHERE id=$3`, status, nullableError(healthErr), id)
	if healthErr != nil {
		s.activity(r.Context(), workspaceID, id, "challenge_detected", "Channel account requires manual verification", map[string]any{"status": status})
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": status, "message": healthMessage(health, healthErr), "checked_at": time.Now().UTC()})
}

func (s *Service) handleComments(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	limit := 25
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if value, parseErr := strconv.Atoi(raw); parseErr == nil && value > 0 && value <= 100 {
			limit = value
		}
	}
	search := r.URL.Query().Get("search")
	rows, err := s.pool.Query(r.Context(), `SELECT c.id::text, c.username, c.text, c.external_post_id, c.status, c.commented_at, cc.name, cc.channel_type, COALESCE(ar.status,'not_run') FROM comments c JOIN channel_connections cc ON cc.id=c.channel_connection_id LEFT JOIN LATERAL (SELECT status FROM automation_runs WHERE comment_id=c.id ORDER BY created_at DESC LIMIT 1) ar ON true WHERE c.workspace_id=$1 AND ($2='' OR c.username ILIKE '%'||$2||'%' OR c.text ILIKE '%'||$2||'%') ORDER BY c.created_at DESC LIMIT $3`, workspaceID, search, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, username, text, postID, status, channelName, channelType, automationStatus string
		var commentedAt *time.Time
		if err := rows.Scan(&id, &username, &text, &postID, &status, &commentedAt, &channelName, &channelType, &automationStatus); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		result = append(result, map[string]any{"id": id, "username": username, "text": text, "post_id": postID, "status": status, "commented_at": commentedAt, "channel_name": channelName, "channel_type": channelType, "automation_status": automationStatus})
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result, "limit": limit})
}

func (s *Service) handleContacts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rows, err := s.pool.Query(r.Context(), `SELECT c.id::text, c.name, c.username, c.avatar_url, c.created_at, count(ci.id)::int FROM contacts c LEFT JOIN contact_identities ci ON ci.contact_id=c.id WHERE c.tenant_id=$1 GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, name string
		var username, avatar *string
		var created *time.Time
		var identities int
		if err := rows.Scan(&id, &name, &username, &avatar, &created, &identities); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		result = append(result, map[string]any{"id": id, "name": name, "username": username, "avatar_url": avatar, "identities": identities, "created_at": created})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleContact(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/contacts/"), "/")
	var name string
	var username, avatar *string
	if err := s.pool.QueryRow(r.Context(), `SELECT name, username, avatar_url FROM contacts WHERE id=$1 AND tenant_id=$2`, id, workspaceID).Scan(&name, &username, &avatar); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "name": name, "username": username, "avatar_url": avatar})
}

type automationInput struct {
	Name        string                     `json:"name"`
	ChannelType string                     `json:"channel_type"`
	EventType   string                     `json:"event_type"`
	Status      string                     `json:"status"`
	Conditions  []automationInputCondition `json:"conditions"`
	Actions     []automationInputAction    `json:"actions"`
}
type automationInputCondition struct {
	Type          string `json:"type"`
	Operator      string `json:"operator"`
	Value         string `json:"value"`
	CaseSensitive bool   `json:"case_sensitive"`
}
type automationInputAction struct {
	Type          string         `json:"type"`
	Config        map[string]any `json:"config"`
	ExecutionMode string         `json:"execution_mode"`
}

func (s *Service) handleAutomations(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if r.Method == http.MethodGet {
		s.listAutomations(w, r, workspaceID)
		return
	}
	if r.Method == http.MethodPost {
		s.createAutomation(w, r, workspaceID)
		return
	}
	writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
}

func (s *Service) listAutomations(w http.ResponseWriter, r *http.Request, workspaceID string) {
	rows, err := s.pool.Query(r.Context(), `SELECT ar.id::text, ar.name, ar.channel_type, ar.event_type, ar.status, ar.created_at, count(run.id)::int FROM automation_rules ar LEFT JOIN automation_runs run ON run.automation_rule_id=ar.id WHERE ar.workspace_id=$1 GROUP BY ar.id ORDER BY ar.created_at DESC`, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, name, ct, event, status string
		var created *time.Time
		var runs int
		if err := rows.Scan(&id, &name, &ct, &event, &status, &created, &runs); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		result = append(result, map[string]any{"id": id, "name": name, "channel_type": ct, "event_type": event, "status": status, "runs": runs, "created_at": created})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) createAutomation(w http.ResponseWriter, r *http.Request, workspaceID string) {
	var input automationInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if input.Name == "" {
		input.Name = "Instagram comment automation"
	}
	if input.ChannelType == "" {
		input.ChannelType = "instagram"
	}
	if input.EventType == "" {
		input.EventType = "comment.created"
	}
	if input.Status == "" {
		input.Status = "draft"
	}
	var ruleID string
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer tx.Rollback(r.Context())
	if err := tx.QueryRow(r.Context(), `INSERT INTO automation_rules (workspace_id,name,channel_type,event_type,status) VALUES ($1,$2,$3,$4,$5) RETURNING id::text`, workspaceID, input.Name, input.ChannelType, input.EventType, input.Status).Scan(&ruleID); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	for index, condition := range input.Conditions {
		meta := map[string]any{"case_sensitive": condition.CaseSensitive}
		metaJSON, _ := json.Marshal(meta)
		if _, err := tx.Exec(r.Context(), `INSERT INTO automation_conditions (automation_rule_id,type,operator,value,metadata,sort_order) VALUES ($1,$2,$3,$4,$5,$6)`, ruleID, condition.Type, condition.Operator, condition.Value, metaJSON, index); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	}
	for index, action := range input.Actions {
		if action.ExecutionMode == "" {
			action.ExecutionMode = "manual"
		}
		configJSON, _ := json.Marshal(action.Config)
		if _, err := tx.Exec(r.Context(), `INSERT INTO automation_actions (automation_rule_id,type,metadata,execution_mode,sort_order) VALUES ($1,$2,$3,$4,$5)`, ruleID, action.Type, configJSON, action.ExecutionMode, index); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	}
	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": ruleID, "name": input.Name, "status": input.Status})
}

func (s *Service) handleAutomation(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/automations/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, fmt.Errorf("automation not found"))
		return
	}
	id := parts[0]
	if len(parts) == 1 && r.Method == http.MethodGet {
		s.getAutomation(w, r, workspaceID, id)
		return
	}
	if len(parts) == 1 && r.Method == http.MethodPut {
		s.updateAutomation(w, r, workspaceID, id)
		return
	}
	if len(parts) == 2 && r.Method == http.MethodPost {
		status := "active"
		if parts[1] == "deactivate" {
			status = "draft"
		}
		if parts[1] != "activate" && parts[1] != "deactivate" {
			writeError(w, http.StatusNotFound, fmt.Errorf("automation operation not found"))
			return
		}
		_, err = s.pool.Exec(r.Context(), `UPDATE automation_rules SET status=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3`, status, id, workspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": status})
		return
	}
	if len(parts) == 1 && r.Method == http.MethodDelete {
		_, err = s.pool.Exec(r.Context(), `DELETE FROM automation_rules WHERE id=$1 AND workspace_id=$2`, id, workspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
}

func (s *Service) getAutomation(w http.ResponseWriter, r *http.Request, workspaceID, id string) {
	var name, channelType, eventType, status string
	if err := s.pool.QueryRow(r.Context(), `SELECT name, channel_type, event_type, status FROM automation_rules WHERE id=$1 AND workspace_id=$2`, id, workspaceID).Scan(&name, &channelType, &eventType, &status); err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	conditions, err := s.pool.Query(r.Context(), `SELECT type, operator, value, metadata FROM automation_conditions WHERE automation_rule_id=$1 ORDER BY sort_order`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer conditions.Close()
	conditionResult := []map[string]any{}
	for conditions.Next() {
		var typ, operator, value string
		var metadata []byte
		if err := conditions.Scan(&typ, &operator, &value, &metadata); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		var meta map[string]any
		_ = json.Unmarshal(metadata, &meta)
		conditionResult = append(conditionResult, map[string]any{"type": typ, "operator": operator, "value": value, "config": meta})
	}
	actions, err := s.pool.Query(r.Context(), `SELECT type, metadata, execution_mode FROM automation_actions WHERE automation_rule_id=$1 ORDER BY sort_order`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer actions.Close()
	actionResult := []map[string]any{}
	for actions.Next() {
		var typ, mode string
		var metadata []byte
		if err := actions.Scan(&typ, &metadata, &mode); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		var meta map[string]any
		_ = json.Unmarshal(metadata, &meta)
		actionResult = append(actionResult, map[string]any{"type": typ, "config": meta, "execution_mode": mode})
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "name": name, "channel_type": channelType, "event_type": eventType, "status": status, "conditions": conditionResult, "actions": actionResult})
}

func (s *Service) updateAutomation(w http.ResponseWriter, r *http.Request, workspaceID, id string) {
	var input automationInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	tx, err := s.pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer tx.Rollback(r.Context())
	_, err = tx.Exec(r.Context(), `UPDATE automation_rules SET name=COALESCE(NULLIF($1,''),name),channel_type=COALESCE(NULLIF($2,''),channel_type),event_type=COALESCE(NULLIF($3,''),event_type),status=COALESCE(NULLIF($4,''),status),updated_at=now() WHERE id=$5 AND workspace_id=$6`, input.Name, input.ChannelType, input.EventType, input.Status, id, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if input.Conditions != nil {
		if _, err = tx.Exec(r.Context(), `DELETE FROM automation_conditions WHERE automation_rule_id=$1`, id); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		for index, c := range input.Conditions {
			meta := map[string]any{"case_sensitive": c.CaseSensitive}
			metaJSON, _ := json.Marshal(meta)
			if _, err = tx.Exec(r.Context(), `INSERT INTO automation_conditions (automation_rule_id,type,operator,value,metadata,sort_order) VALUES ($1,$2,$3,$4,$5,$6)`, id, c.Type, c.Operator, c.Value, metaJSON, index); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
		}
	}
	if input.Actions != nil {
		if _, err = tx.Exec(r.Context(), `DELETE FROM automation_actions WHERE automation_rule_id=$1`, id); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		for index, a := range input.Actions {
			if a.ExecutionMode == "" {
				a.ExecutionMode = "manual"
			}
			configJSON, _ := json.Marshal(a.Config)
			if _, err = tx.Exec(r.Context(), `INSERT INTO automation_actions (automation_rule_id,type,metadata,execution_mode,sort_order) VALUES ($1,$2,$3,$4,$5)`, id, a.Type, configJSON, a.ExecutionMode, index); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
		}
	}
	if err = tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "updated": true})
}

func (s *Service) handlePendingActions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rows, err := s.pool.Query(r.Context(), `SELECT pa.id::text, pa.action_type, pa.status, pa.payload, pa.created_at, cc.name, c.username, c.text FROM pending_actions pa JOIN channel_action_runs ar ON ar.id=pa.channel_action_run_id JOIN channel_connections cc ON cc.id=ar.connection_id LEFT JOIN comments c ON c.id=(pa.payload->>'comment_id')::uuid WHERE pa.workspace_id=$1 ORDER BY pa.created_at DESC LIMIT 100`, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, typ, status, channelName, username, text string
		var payload []byte
		var created *time.Time
		if err := rows.Scan(&id, &typ, &status, &payload, &created, &channelName, &username, &text); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		var data map[string]any
		_ = json.Unmarshal(payload, &data)
		result = append(result, map[string]any{"id": id, "action_type": typ, "status": status, "payload": data, "created_at": created, "channel_name": channelName, "username": username, "text": text})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handlePendingAction(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/pending-actions/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" || r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	id := parts[0]
	action := "approve"
	if len(parts) > 1 {
		action = parts[1]
	} else if queryAction := r.URL.Query().Get("action"); queryAction != "" {
		action = queryAction
	}
	switch action {
	case "reject":
		err = s.RejectPendingAction(r.Context(), workspaceID, id)
	case "approve":
		err = s.ApprovePendingAction(r.Context(), workspaceID, id)
	default:
		writeError(w, http.StatusNotFound, fmt.Errorf("pending action operation not found"))
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": action})
}

func (s *Service) handleActivity(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rows, err := s.pool.Query(r.Context(), `SELECT id::text,type,description,metadata,created_at FROM activity_logs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100`, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var id, typ, description string
		var meta []byte
		var created *time.Time
		if err := rows.Scan(&id, &typ, &description, &meta, &created); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		var data map[string]any
		_ = json.Unmarshal(meta, &data)
		result = append(result, map[string]any{"id": id, "type": typ, "description": description, "metadata": data, "created_at": created})
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Service) handleAutomationKillSwitch(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if r.Method == http.MethodGet {
		var paused bool
		if err := s.pool.QueryRow(r.Context(), `SELECT COALESCE((settings->>'pause_all_instagram_automations')::boolean, false) FROM tenants WHERE id=$1`, workspaceID).Scan(&paused); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"pause_all_instagram_automations": paused})
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	var body struct {
		Paused bool `json:"pause_all_instagram_automations"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	_, err = s.pool.Exec(r.Context(), `UPDATE tenants SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb), '{pause_all_instagram_automations}', to_jsonb($2::boolean), true), updated_at=now() WHERE id=$1`, workspaceID, body.Paused)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	s.activity(r.Context(), workspaceID, "", "account_paused", "Global Instagram automation kill switch changed", map[string]any{"paused": body.Paused})
	writeJSON(w, http.StatusOK, map[string]any{"pause_all_instagram_automations": body.Paused})
}

func (s *Service) handleEvents(w http.ResponseWriter, r *http.Request) {
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if s.bus == nil {
		writeError(w, http.StatusServiceUnavailable, fmt.Errorf("realtime bus unavailable"))
		return
	}
	sub := s.bus.Subscribe(r.Context(), workspaceID)
	defer sub.Close()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, fmt.Errorf("streaming unsupported"))
		return
	}
	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg, open := <-sub.Channel():
			if !open {
				return
			}
			if msg.Payload == "" {
				continue
			}
			fmt.Fprintf(w, "event: omnichannel\ndata: %s\n\n", msg.Payload)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprint(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

type mockCommentRequest struct {
	ConnectionID      string `json:"connection_id"`
	PostID            string `json:"post_id"`
	ExternalCommentID string `json:"external_comment_id"`
	ExternalUserID    string `json:"external_user_id"`
	Username          string `json:"username"`
	Text              string `json:"text"`
}

func (s *Service) handleMockComment(w http.ResponseWriter, r *http.Request) {
	s.handleMockCommentForChannel(w, r, "instagram")
}

func (s *Service) handleMockFacebookComment(w http.ResponseWriter, r *http.Request) {
	s.handleMockCommentForChannel(w, r, "facebook")
}

func (s *Service) handleMockCommentForChannel(w http.ResponseWriter, r *http.Request, expectedChannelType string) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var input mockCommentRequest
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	id, duplicate, err := s.ingestMockCommentForChannel(r.Context(), workspaceID, input, expectedChannelType)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"comment_id": id, "duplicate": duplicate, "queued": !duplicate})
}

func (s *Service) handleMockComments(w http.ResponseWriter, r *http.Request) {
	s.handleMockCommentsForChannel(w, r, "instagram")
}

func (s *Service) handleMockFacebookComments(w http.ResponseWriter, r *http.Request) {
	s.handleMockCommentsForChannel(w, r, "facebook")
}

func (s *Service) handleMockCommentsForChannel(w http.ResponseWriter, r *http.Request, expectedChannelType string) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("method not allowed"))
		return
	}
	workspaceID, err := s.workspaceFromRequest(r.Context(), r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	var body struct {
		ConnectionID string `json:"connection_id"`
		PostID       string `json:"post_id"`
		Count        int    `json:"count"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	if body.Count < 1 || body.Count > 50 {
		body.Count = 50
	}
	created := 0
	for i := 1; i <= body.Count; i++ {
		input := mockCommentRequest{ConnectionID: body.ConnectionID, PostID: body.PostID, ExternalCommentID: fmt.Sprintf("mock-comment-%03d", i), ExternalUserID: fmt.Sprintf("user%03d", i), Username: fmt.Sprintf("user%03d", i), Text: "Mau"}
		_, duplicate, err := s.ingestMockCommentForChannel(r.Context(), workspaceID, input, expectedChannelType)
		if err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		if !duplicate {
			created++
		}
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"requested": body.Count, "created": created, "queued": created})
}

func (s *Service) ingestMockComment(ctx context.Context, workspaceID string, input mockCommentRequest) (string, bool, error) {
	return s.ingestMockCommentForChannel(ctx, workspaceID, input, "instagram")
}

func (s *Service) ingestMockCommentForChannel(ctx context.Context, workspaceID string, input mockCommentRequest, expectedChannelType string) (string, bool, error) {
	if input.ConnectionID == "" || input.PostID == "" || input.Username == "" || input.Text == "" {
		return "", false, fmt.Errorf("connection_id, post_id, username, and text are required")
	}
	if input.ExternalUserID == "" {
		input.ExternalUserID = input.Username
	}
	if input.ExternalCommentID == "" {
		input.ExternalCommentID = uuid.NewString()
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer tx.Rollback(ctx)
	// Serialize identity creation for the same channel/user. This closes the
	// race where two duplicate inbound events could otherwise create two contact
	// rows before the unique identity constraint is reached.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2 || ':' || $3, 0))`, workspaceID, input.ConnectionID, input.ExternalUserID); err != nil {
		return "", false, err
	}
	var channelType string
	if err := tx.QueryRow(ctx, `SELECT channel_type FROM channel_connections WHERE id=$1 AND workspace_id=$2`, input.ConnectionID, workspaceID).Scan(&channelType); err != nil {
		return "", false, err
	}
	if channelType != expectedChannelType {
		return "", false, fmt.Errorf("mock comment requires a %s connection", expectedChannelType)
	}
	var contactID string
	err = tx.QueryRow(ctx, `SELECT contact_id::text FROM contact_identities WHERE workspace_id=$1 AND channel_connection_id=$2 AND external_user_id=$3`, workspaceID, input.ConnectionID, input.ExternalUserID).Scan(&contactID)
	if errors.Is(err, pgx.ErrNoRows) {
		if err = tx.QueryRow(ctx, `INSERT INTO contacts (tenant_id,name,username,external_id) VALUES ($1,$2,$3,$4) RETURNING id::text`, workspaceID, input.Username, input.Username, input.ExternalUserID).Scan(&contactID); err != nil {
			return "", false, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO contact_identities (workspace_id,contact_id,channel_type,channel_connection_id,external_user_id,username) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, workspaceID, contactID, expectedChannelType, input.ConnectionID, input.ExternalUserID, input.Username); err != nil {
			return "", false, err
		}
	} else if err != nil {
		return "", false, err
	}
	var commentID string
	err = tx.QueryRow(ctx, `INSERT INTO comments (workspace_id,channel_connection_id,external_comment_id,external_post_id,contact_id,username,text,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'received') ON CONFLICT (channel_connection_id,external_comment_id) DO NOTHING RETURNING id::text`, workspaceID, input.ConnectionID, input.ExternalCommentID, input.PostID, contactID, input.Username, normalizeText(input.Text)).Scan(&commentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", true, nil
	}
	if err != nil {
		return "", false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO channel_posts (workspace_id,channel_connection_id,external_post_id,type) VALUES ($1,$2,$3,'post') ON CONFLICT DO NOTHING`, workspaceID, input.ConnectionID, input.PostID); err != nil {
		return "", false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", false, err
	}
	s.activity(ctx, workspaceID, input.ConnectionID, "comment_received", "New "+expectedChannelType+" comment received", map[string]any{"comment_id": commentID, "username": input.Username})
	s.emit(ctx, workspaceID, "comment.created", map[string]any{"comment_id": commentID, "contact_id": contactID, "text": input.Text})
	if err := s.enqueueComment(ctx, workspaceID, input.ConnectionID, commentID); err != nil {
		return commentID, false, err
	}
	return commentID, false, nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]any{"error": err.Error()})
}
func decodeJSON(r *http.Request, target any) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}
func nullableError(err error) any {
	if err == nil {
		return nil
	}
	return err.Error()
}
func healthMessage(health *channel.Health, err error) string {
	if health != nil && health.Message != "" {
		return health.Message
	}
	if err != nil {
		return err.Error()
	}
	return "healthy"
}
