package channels

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/chatcepat/gateway/internal/contracts"
)

func TestVerifySignature(t *testing.T) {
	secret := "topsecret"
	body := []byte(`{"object":"whatsapp_business_account"}`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	header := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !VerifySignature(secret, body, header) {
		t.Fatal("signature valid harus lolos")
	}
	if VerifySignature(secret, body, "sha256=deadbeef") {
		t.Fatal("signature salah harus ditolak")
	}
	if VerifySignature("wrong", body, header) {
		t.Fatal("secret salah harus ditolak")
	}
}

func TestVerifyChallenge(t *testing.T) {
	if c, ok := VerifyChallenge("tok", "subscribe", "tok", "123"); !ok || c != "123" {
		t.Fatalf("challenge harus lolos, got %q %v", c, ok)
	}
	if _, ok := VerifyChallenge("tok", "subscribe", "salah", "123"); ok {
		t.Fatal("token salah harus gagal")
	}
}

func TestParseWhatsAppCloud(t *testing.T) {
	body := []byte(`{"entry":[{"changes":[{"value":{
		"metadata":{"phone_number_id":"PN123"},
		"contacts":[{"wa_id":"628111","profile":{"name":"Budi"}}],
		"messages":[{"from":"628111","id":"wamid.A","timestamp":"1","type":"text","text":{"body":"halo"}}]
	}}]}]}`)
	parsed, err := ParseWhatsAppCloud(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed) != 1 {
		t.Fatalf("harus 1 pesan, got %d", len(parsed))
	}
	p := parsed[0]
	if p.PhoneNumberID != "PN123" {
		t.Fatalf("phone_number_id salah: %q", p.PhoneNumberID)
	}
	if p.Inbound.ProviderMessageId != "wamid.A" || p.Inbound.Body == nil || *p.Inbound.Body != "halo" {
		t.Fatalf("normalisasi salah: %+v", p.Inbound)
	}
}

func TestParseMessengerFacebook(t *testing.T) {
	body := []byte(`{"object":"page","entry":[{"id":"PAGE123","messaging":[
		{"sender":{"id":"PSID9"},"recipient":{"id":"PAGE123"},"timestamp":1700000000000,
		 "message":{"mid":"mid.fb1","text":"halo fb"}}]}]}`)
	parsed, err := ParseMessenger(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed) != 1 {
		t.Fatalf("harus 1 pesan, got %d", len(parsed))
	}
	p := parsed[0]
	if p.ExternalID != "PAGE123" {
		t.Fatalf("external_id (page) salah: %q", p.ExternalID)
	}
	if p.Inbound.ChannelType != contracts.ChannelTypeFacebook {
		t.Fatalf("channel type salah: %q", p.Inbound.ChannelType)
	}
	if p.Inbound.From.ExternalId != "PSID9" || p.Inbound.ProviderMessageId != "mid.fb1" ||
		p.Inbound.Body == nil || *p.Inbound.Body != "halo fb" {
		t.Fatalf("normalisasi salah: %+v", p.Inbound)
	}
}

func TestParseMessengerInstagramSkipsEcho(t *testing.T) {
	body := []byte(`{"object":"instagram","entry":[{"id":"IG777","messaging":[
		{"sender":{"id":"ME"},"message":{"mid":"mid.echo","text":"keluar","is_echo":true}},
		{"sender":{"id":"IGSID5"},"message":{"mid":"mid.ig1","text":"halo ig"}}]}]}`)
	parsed, err := ParseMessenger(body)
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed) != 1 {
		t.Fatalf("echo harus dilewati, got %d", len(parsed))
	}
	p := parsed[0]
	if p.ExternalID != "IG777" || p.Inbound.ChannelType != contracts.ChannelTypeInstagram {
		t.Fatalf("ig parse salah: ext=%q type=%q", p.ExternalID, p.Inbound.ChannelType)
	}
	if p.Inbound.From.ExternalId != "IGSID5" || p.Inbound.Body == nil || *p.Inbound.Body != "halo ig" {
		t.Fatalf("normalisasi salah: %+v", p.Inbound)
	}
}
