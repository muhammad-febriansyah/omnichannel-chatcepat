package social

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type ruleRequest struct {
	AccountID  string            `json:"account_id" binding:"required"`
	Name       string            `json:"name" binding:"required"`
	Platform   string            `json:"platform" binding:"required"`
	SourceType string            `json:"source_type" binding:"required"`
	MatchType  string            `json:"match_type" binding:"required"`
	IsActive   bool              `json:"is_active"`
	Priority   int               `json:"priority"`
	Keywords   []string          `json:"keywords"`
	Actions    []AutoReplyAction `json:"actions"`
}

func (r ruleRequest) input() RuleInput {
	keywords := make([]string, 0, len(r.Keywords))
	for _, keyword := range r.Keywords {
		if value := NormalizeContent(keyword); value != "" {
			keywords = append(keywords, value)
		}
	}
	return RuleInput{
		Name: strings.TrimSpace(r.Name), Platform: strings.ToLower(strings.TrimSpace(r.Platform)),
		SourceType: strings.ToLower(strings.TrimSpace(r.SourceType)), MatchType: strings.ToLower(strings.TrimSpace(r.MatchType)),
		IsActive: r.IsActive, Priority: r.Priority, Keywords: keywords, Actions: r.Actions,
	}
}

type settingsRequest struct {
	AutomationEnabled          bool `json:"automation_enabled"`
	CommentScannerEnabled      bool `json:"comment_scanner_enabled"`
	MessageScannerEnabled      bool `json:"message_scanner_enabled"`
	CommentReplyEnabled        bool `json:"comment_reply_enabled"`
	CommentPrivateReplyEnabled bool `json:"comment_private_reply_enabled"`
	MessageReplyEnabled        bool `json:"message_reply_enabled"`
	ReplyCooldownSeconds       int  `json:"reply_cooldown_seconds"`
	MaxConsecutiveErrors       int  `json:"max_consecutive_errors"`
}

func (r settingsRequest) settings(accountID string) AutomationSettings {
	return AutomationSettings{
		SocialAccountID: accountID, AutomationEnabled: r.AutomationEnabled,
		CommentScannerEnabled: r.CommentScannerEnabled, MessageScannerEnabled: r.MessageScannerEnabled,
		CommentReplyEnabled: r.CommentReplyEnabled, CommentPrivateReplyEnabled: r.CommentPrivateReplyEnabled,
		MessageReplyEnabled: r.MessageReplyEnabled, ReplyCooldownSeconds: r.ReplyCooldownSeconds,
		MaxConsecutiveErrors: r.MaxConsecutiveErrors,
	}
}

func (a *API) listRules(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	rules, err := a.service.repo.ListRules(c.Request.Context(), tenantID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation rules loaded", rules)
}

func (a *API) createRule(c *gin.Context) {
	var request ruleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	rule, err := a.service.repo.CreateRule(c.Request.Context(), tenantID, request.AccountID, request.input())
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusCreated, "Automation rule created", rule)
}

func (a *API) getRule(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	rule, err := a.service.repo.GetRule(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation rule loaded", rule)
}

func (a *API) updateRule(c *gin.Context) {
	var request ruleRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	rule, err := a.service.repo.UpdateRule(c.Request.Context(), tenantID, c.Param("id"), request.input())
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation rule updated", rule)
}

func (a *API) deleteRule(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err == nil {
		err = a.service.repo.DeleteRule(c.Request.Context(), tenantID, c.Param("id"))
	}
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation rule deleted", nil)
}

func (a *API) setRuleActive(c *gin.Context, active bool) {
	tenantID, err := a.tenantID(c)
	if err == nil {
		err = a.service.repo.SetRuleActive(c.Request.Context(), tenantID, c.Param("id"), active)
	}
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation rule status updated", map[string]bool{"is_active": active})
}

func (a *API) enableRule(c *gin.Context)  { a.setRuleActive(c, true) }
func (a *API) disableRule(c *gin.Context) { a.setRuleActive(c, false) }

func (a *API) listIncoming(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	events, err := a.service.repo.ListIncomingEvents(c.Request.Context(), tenantID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, err)
		return
	}
	writeSuccess(c, http.StatusOK, "Incoming social events loaded", events)
}

func (a *API) automationActivity(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	items, err := a.service.repo.ListActivity(c.Request.Context(), tenantID, strings.TrimSpace(c.Query("account_id")))
	if err != nil {
		writeError(c, http.StatusInternalServerError, err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation activity loaded", items)
}

func (a *API) getAutomationSettings(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err == nil {
		_, err = a.service.repo.GetAccount(c.Request.Context(), tenantID, c.Param("id"))
	}
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	settings, err := a.service.repo.GetSettings(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation settings loaded", settings)
}

func (a *API) updateAutomationSettings(c *gin.Context) {
	var request settingsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	settings, err := a.service.repo.UpdateSettings(c.Request.Context(), tenantID, c.Param("id"), request.settings(c.Param("id")))
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Automation settings updated", settings)
}
