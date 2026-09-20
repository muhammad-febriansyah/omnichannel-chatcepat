// Package cryptography contains small, dependency-free primitives used to keep
// channel credentials and sessions encrypted at rest.
package cryptography

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
)

// SessionCipher encrypts opaque channel data with AES-256-GCM. The key must be
// supplied as raw 32 bytes or as any string, which is deterministically hashed
// to 32 bytes for convenient environment-variable usage.
type SessionCipher struct {
	key []byte
}

func NewSessionCipher(secret string) (*SessionCipher, error) {
	if secret == "" {
		return nil, fmt.Errorf("SESSION_ENCRYPTION_KEY is required")
	}
	h := sha256.Sum256([]byte(secret))
	return &SessionCipher{key: h[:]}, nil
}

func (c *SessionCipher) Encrypt(plain []byte) ([]byte, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("create nonce: %w", err)
	}
	return gcm.Seal(nonce, nonce, plain, nil), nil
}

func (c *SessionCipher) Decrypt(ciphertext []byte) ([]byte, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, fmt.Errorf("create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, fmt.Errorf("ciphertext is too short")
	}
	nonce, payload := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, payload, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt session: %w", err)
	}
	return plain, nil
}
