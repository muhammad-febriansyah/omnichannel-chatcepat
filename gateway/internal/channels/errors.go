package channels

import "errors"

// TransientError menandai kegagalan kirim yang layak di-retry: gangguan jaringan,
// timeout, atau 5xx/429 dari provider. Lawannya = error permanen (4xx, payload
// invalid, template ditolak) yang retry-nya sia-sia. Worker outbound retry hanya
// bila IsTransient(err) true. Adapter yang TIDAK aman di-retry (mis. whatsmeow,
// rawan dobel-kirim/banned) cukup kembalikan error biasa → tak pernah di-retry.
type TransientError struct{ Err error }

func (e *TransientError) Error() string { return e.Err.Error() }
func (e *TransientError) Unwrap() error { return e.Err }

// Transient membungkus err sebagai transient (retryable). nil → nil.
func Transient(err error) error {
	if err == nil {
		return nil
	}
	return &TransientError{Err: err}
}

// IsTransient true bila err (atau yang dibungkusnya) adalah TransientError.
func IsTransient(err error) bool {
	var t *TransientError
	return errors.As(err, &t)
}
