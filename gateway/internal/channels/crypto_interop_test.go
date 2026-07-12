package channels

import (
	"os"
	"testing"
)

// Interop: ciphertext dibuat Node (lib/channel-crypto.ts) via env, didekripsi Go.
func TestDecryptInterop(t *testing.T) {
	ct := os.Getenv("CRED_CT")
	want := os.Getenv("CRED_PLAIN")
	if ct == "" || want == "" {
		t.Skip("CRED_CT/CRED_PLAIN tak diset")
	}
	got := decryptCredentials(Credentials{"access_token": ct, "plain_field": "biarkan"})
	if got["access_token"] != want {
		t.Fatalf("decrypt = %q, want %q", got["access_token"], want)
	}
	if got["plain_field"] != "biarkan" {
		t.Fatalf("plaintext field berubah: %q", got["plain_field"])
	}
}
