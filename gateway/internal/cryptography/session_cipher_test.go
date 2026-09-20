package cryptography

import "testing"

func TestSessionCipherRoundTripAndTamperDetection(t *testing.T) {
	cipher, err := NewSessionCipher("test-session-key")
	if err != nil {
		t.Fatal(err)
	}
	plain := []byte(`{"username":"demo","session":"opaque"}`)
	ciphertext, err := cipher.Encrypt(plain)
	if err != nil {
		t.Fatal(err)
	}
	if string(ciphertext) == string(plain) {
		t.Fatal("expected ciphertext to differ from plaintext")
	}
	decoded, err := cipher.Decrypt(ciphertext)
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != string(plain) {
		t.Fatalf("decoded %q, want %q", decoded, plain)
	}
	ciphertext[len(ciphertext)-1] ^= 1
	if _, err := cipher.Decrypt(ciphertext); err == nil {
		t.Fatal("expected tampered ciphertext to fail authentication")
	}
}
