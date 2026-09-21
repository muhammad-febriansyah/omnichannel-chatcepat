package social

import "errors"

var (
	ErrAccountNotFound       = errors.New("social account not found")
	ErrJobNotFound           = errors.New("social job not found")
	ErrAccountBusy           = errors.New("social account is already in use")
	ErrAccountNotConnected   = errors.New("social account is not connected")
	ErrUnsupportedPlatform   = errors.New("unsupported social platform")
	ErrUnsupportedAction     = errors.New("unsupported social action")
	ErrAutomationNotReady    = errors.New("social browser automation is not implemented yet")
	ErrInvalidTargetURL      = errors.New("target URL does not match the account platform")
	ErrContentRequired       = errors.New("comment content is required")
	ErrAccountActionRequired = errors.New("social account requires manual action")
)
