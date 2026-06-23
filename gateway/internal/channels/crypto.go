package channels

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"os"
	"strings"
	"sync"
)

// credPrefix menandai value kredensial yang ter-enkripsi (AES-256-GCM). Web yang
// meng-enkripsi (lib/channel-crypto.ts); gateway hanya dekripsi saat baca.
const credPrefix = "enc:v1:"

var (
	credKeyOnce sync.Once
	credGCM     cipher.AEAD
)

// loadCredKey baca CHANNEL_CRED_KEY (base64 32-byte). Kosong/invalid → nil (passthrough
// plaintext: dev tanpa key / data legacy). Key WAJIB sama dengan web.
func loadCredKey() {
	raw := os.Getenv("CHANNEL_CRED_KEY")
	if raw == "" {
		return
	}
	k, err := base64.StdEncoding.DecodeString(raw)
	if err != nil || len(k) != 32 {
		return
	}
	block, err := aes.NewCipher(k)
	if err != nil {
		return
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return
	}
	credGCM = gcm
}

// decryptCredentials mendekripsi value bertanda enc:v1:. Value plaintext atau gagal
// decrypt dibiarkan apa adanya (best-effort, tak menggagalkan routing).
func decryptCredentials(creds Credentials) Credentials {
	credKeyOnce.Do(loadCredKey)
	if credGCM == nil {
		return creds
	}
	out := make(Credentials, len(creds))
	for field, val := range creds {
		s, ok := val.(string)
		if !ok || !strings.HasPrefix(s, credPrefix) {
			out[field] = val
			continue
		}
		data, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(s, credPrefix))
		if err != nil || len(data) < credGCM.NonceSize() {
			out[field] = val
			continue
		}
		nonce := data[:credGCM.NonceSize()]
		pt, err := credGCM.Open(nil, nonce, data[credGCM.NonceSize():], nil)
		if err != nil {
			out[field] = val
			continue
		}
		out[field] = string(pt)
	}
	return out
}
