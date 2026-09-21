package social

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type API struct {
	service *Service
	config  Config
}

func NewAPI(service *Service, config Config) *API {
	return &API{service: service, config: config}
}

func (a *API) Handler() http.Handler {
	r := gin.New()
	r.Use(gin.Recovery(), a.authenticate)
	r.GET("/accounts", a.listAccounts)
	r.POST("/accounts", a.createAccount)
	r.GET("/accounts/:id", a.getAccount)
	r.POST("/accounts/:id/connect", a.connectAccount)
	r.POST("/accounts/:id/open-browser", a.openBrowser)
	r.POST("/accounts/:id/validate-session", a.validateSession)
	r.POST("/accounts/:id/disconnect", a.disconnectAccount)
	r.POST("/accounts/:id/pause", a.pauseAccount)
	r.POST("/accounts/:id/resume", a.resumeAccount)
	r.GET("/accounts/:id/automation/settings", a.getAutomationSettings)
	r.PUT("/accounts/:id/automation/settings", a.updateAutomationSettings)
	r.POST("/accounts/:id/automation/pause", a.pauseAccount)
	r.POST("/accounts/:id/automation/resume", a.resumeAccount)
	r.GET("/accounts/:id/logs", a.accountLogs)
	r.GET("/jobs", a.listJobs)
	r.POST("/jobs", a.createJob)
	r.GET("/jobs/:id", a.getJob)
	r.POST("/jobs/:id/cancel", a.cancelJob)
	r.GET("/dashboard/stats", a.dashboardStats)
	r.GET("/automation/rules", a.listRules)
	r.POST("/automation/rules", a.createRule)
	r.GET("/automation/rules/:id", a.getRule)
	r.PUT("/automation/rules/:id", a.updateRule)
	r.DELETE("/automation/rules/:id", a.deleteRule)
	r.POST("/automation/rules/:id/enable", a.enableRule)
	r.POST("/automation/rules/:id/disable", a.disableRule)
	r.GET("/automation/incoming", a.listIncoming)
	r.GET("/automation/activity", a.automationActivity)
	return r
}

type envelope struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func writeSuccess(c *gin.Context, status int, message string, data any) {
	c.JSON(status, envelope{Success: true, Message: message, Data: data})
}

func writeError(c *gin.Context, status int, err error) {
	c.JSON(status, envelope{Success: false, Message: err.Error()})
}

func (a *API) authenticate(c *gin.Context) {
	if a.config.APIAuthToken != "" {
		want := "Bearer " + a.config.APIAuthToken
		if c.GetHeader("Authorization") != want {
			writeError(c, http.StatusUnauthorized, errors.New("social API authentication required"))
			c.Abort()
			return
		}
	} else if a.config.AppEnv != "development" {
		writeError(c, http.StatusServiceUnavailable, errors.New("SOCIAL_API_TOKEN is required outside development"))
		c.Abort()
		return
	}
	c.Next()
}

func (a *API) tenantID(c *gin.Context) (string, error) {
	return a.service.repo.ResolveTenant(c.Request.Context(), strings.TrimSpace(c.GetHeader("X-Workspace-ID")))
}

type createAccountRequest struct {
	Name           string  `json:"name" binding:"required"`
	Platform       string  `json:"platform" binding:"required"`
	Username       *string `json:"username"`
	ExternalUserID *string `json:"external_user_id"`
}

func (a *API) listAccounts(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	accounts, err := a.service.repo.ListAccounts(c.Request.Context(), tenantID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, err)
		return
	}
	writeSuccess(c, http.StatusOK, "Accounts loaded", accounts)
}

func (a *API) createAccount(c *gin.Context) {
	var input createAccountRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	account, err := a.service.CreateAccount(c.Request.Context(), tenantID, input.Name, input.Platform, input.Username)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	if input.ExternalUserID != nil && strings.TrimSpace(*input.ExternalUserID) != "" {
		value := strings.TrimSpace(*input.ExternalUserID)
		if err := a.service.repo.SetExternalUserID(c.Request.Context(), account.ID, value); err != nil {
			writeError(c, http.StatusInternalServerError, err)
			return
		}
		account.ExternalUserID = &value
	}
	writeSuccess(c, http.StatusCreated, "Account created", account)
}

func (a *API) getAccount(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	account, err := a.service.repo.GetAccount(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Account loaded", account)
}

func (a *API) connectAccount(c *gin.Context) { a.startBrowser(c, "Account connection started") }

func (a *API) openBrowser(c *gin.Context) { a.startBrowser(c, "Browser opened") }

func (a *API) validateSession(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err == nil {
		var account Account
		account, err = a.service.ValidateSession(c.Request.Context(), tenantID, c.Param("id"))
		if err == nil {
			writeSuccess(c, http.StatusOK, "Session validated", account)
			return
		}
	}
	writeError(c, statusForError(err), err)
}

func (a *API) startBrowser(c *gin.Context, message string) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	account, err := a.service.StartBrowser(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, message+". Login manually in Chromium.", account)
}

func (a *API) disconnectAccount(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err == nil {
		err = a.service.Disconnect(c.Request.Context(), tenantID, c.Param("id"))
	}
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Account disconnected", nil)
}

func (a *API) pauseAccount(c *gin.Context) { a.changeAccountStatus(c, true) }

func (a *API) resumeAccount(c *gin.Context) { a.changeAccountStatus(c, false) }

func (a *API) changeAccountStatus(c *gin.Context, pause bool) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	var account Account
	if pause {
		account, err = a.service.Pause(c.Request.Context(), tenantID, c.Param("id"))
	} else {
		account, err = a.service.Resume(c.Request.Context(), tenantID, c.Param("id"))
	}
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Account status updated", account)
}

func (a *API) accountLogs(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	logs, err := a.service.repo.ListActivity(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		writeError(c, http.StatusInternalServerError, err)
		return
	}
	writeSuccess(c, http.StatusOK, "Activity logs loaded", logs)
}

func (a *API) listJobs(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	jobs, err := a.service.repo.ListJobs(c.Request.Context(), tenantID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, err)
		return
	}
	writeSuccess(c, http.StatusOK, "Jobs loaded", jobs)
}

type createJobRequest struct {
	AccountID   string `json:"account_id" binding:"required"`
	Action      string `json:"action"`
	TargetURL   string `json:"target_url" binding:"required"`
	Content     string `json:"content" binding:"required"`
	MaxAttempts int    `json:"max_attempts"`
}

func (a *API) createJob(c *gin.Context) {
	var input createJobRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	job, err := a.service.CreateCommentJob(c.Request.Context(), tenantID, input.AccountID, input.TargetURL, input.Content, input.MaxAttempts)
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusCreated, "Job queued", job)
}

func (a *API) getJob(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	job, err := a.service.repo.GetJob(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Job loaded", job)
}

func (a *API) cancelJob(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err == nil {
		err = a.service.CancelJob(c.Request.Context(), tenantID, c.Param("id"))
	}
	if err != nil {
		writeError(c, statusForError(err), err)
		return
	}
	writeSuccess(c, http.StatusOK, "Job cancelled", nil)
}

func (a *API) dashboardStats(c *gin.Context) {
	tenantID, err := a.tenantID(c)
	if err != nil {
		writeError(c, http.StatusBadRequest, err)
		return
	}
	stats, err := a.service.repo.Stats(c.Request.Context(), tenantID)
	if err != nil {
		writeError(c, http.StatusInternalServerError, err)
		return
	}
	writeSuccess(c, http.StatusOK, "Dashboard stats loaded", stats)
}

func statusForError(err error) int {
	switch {
	case errors.Is(err, ErrAccountNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrJobNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrAccountBusy), errors.Is(err, ErrAccountNotConnected), errors.Is(err, ErrAccountActionRequired):
		return http.StatusConflict
	case errors.Is(err, ErrSessionExpired), errors.Is(err, ErrLoginRequired), errors.Is(err, ErrCaptcha), errors.Is(err, ErrCheckpoint), errors.Is(err, ErrSuspiciousLogin), errors.Is(err, ErrConfirmIdentity), errors.Is(err, ErrTemporaryBlock), errors.Is(err, ErrRateLimited):
		return http.StatusConflict
	case errors.Is(err, ErrRuleNotFound), errors.Is(err, ErrIncomingEventNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrInvalidTargetURL), errors.Is(err, ErrContentRequired), errors.Is(err, ErrUnsupportedAction), errors.Is(err, ErrUnsupportedPlatform):
		return http.StatusBadRequest
	case errors.Is(err, ErrRulePlatformMismatch):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}
