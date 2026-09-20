package channel

import "errors"

var (
	ErrAuthentication    = errors.New("channel authentication failed")
	ErrSessionExpired    = errors.New("channel session expired")
	ErrChallengeRequired = errors.New("channel challenge required")
	ErrRateLimited       = errors.New("channel rate limited")
	ErrAccountDisabled   = errors.New("channel account disabled")
	ErrTemporary         = errors.New("temporary channel error")
	ErrPermanent         = errors.New("permanent channel error")
)
