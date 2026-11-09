package ws

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"testing"
	"time"
)

func sign(secret, tenant string, exp int64) string {
	payload := tenant + "." + strconv.FormatInt(exp, 10)
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(payload))
	return payload + "." + hex.EncodeToString(m.Sum(nil))
}

func TestValidToken(t *testing.T) {
	h := &Handler{JWTSecret: "s3cret"}
	now := time.Unix(1_700_000_000, 0)
	good := sign("s3cret", "tenant-a", now.Unix()+60)
	if !h.validToken("tenant-a", good, now) {
		t.Fatal("valid token rejected")
	}
	if h.validToken("tenant-b", good, now) {
		t.Fatal("token for another tenant accepted")
	}
	if h.validToken("tenant-a", sign("other", "tenant-a", now.Unix()+60), now) {
		t.Fatal("wrong secret accepted")
	}
	if h.validToken("tenant-a", sign("s3cret", "tenant-a", now.Unix()-1), now) {
		t.Fatal("expired token accepted")
	}
	if h.validToken("tenant-a", "dev", now) || (&Handler{}).validToken("tenant-a", good, now) {
		t.Fatal("dummy token / empty secret accepted")
	}
}
