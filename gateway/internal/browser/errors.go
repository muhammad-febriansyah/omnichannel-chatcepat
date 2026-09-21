package browser

import "errors"

var (
	ErrProfileBusy    = errors.New("browser profile is already in use")
	ErrInvalidProfile = errors.New("invalid browser profile")
	ErrProfileMissing = errors.New("browser profile does not exist")
)
