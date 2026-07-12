package channels

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/chatcepat/gateway/internal/contracts"
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyApiCoSignature(t *testing.T) {
	body := []byte(`{"event":"message.received"}`)
	secret := "whsec_123"
	good := sign(secret, body)

	if !VerifyApiCoSignature(secret, body, good) {
		t.Fatal("signature valid harus lolos")
	}
	if !VerifyApiCoSignature(secret, body, "sha256="+good) {
		t.Fatal("prefix sha256= harus diterima")
	}
	if VerifyApiCoSignature(secret, body, "deadbeef") {
		t.Fatal("signature salah harus ditolak")
	}
	if !VerifyApiCoSignature("", body, "apa-saja") {
		t.Fatal("secret kosong harus skip (dev)")
	}
}

func TestParseApiCoInbound(t *testing.T) {
	body := []byte(`{
		"event":"message.received","timestamp":"2025-01-07T10:30:00Z",
		"data":{"message_id":"msg_1","customer_id":"cus_1","customer_phone":"628123",
		"channel":"whatsapp","direction":"inbound","message_type":"text","content":"halo",
		"whatsapp_phone_number_id":"PN1"}}`)
	ev, err := ParseApiCoEvent(body)
	if err != nil {
		t.Fatal(err)
	}
	p, ok := ParseApiCoInbound(ev)
	if !ok {
		t.Fatal("harus dikenali sebagai inbound")
	}
	if p.ExternalID != "PN1" {
		t.Fatalf("businessID = %q, mau PN1", p.ExternalID)
	}
	if p.Inbound.ChannelType != contracts.ChannelTypeWaOfficial {
		t.Fatalf("type = %q, mau wa_official", p.Inbound.ChannelType)
	}
	if p.Inbound.ProviderMessageId != "msg_1" {
		t.Fatalf("pmid = %q", p.Inbound.ProviderMessageId)
	}
	if p.Inbound.Body == nil || *p.Inbound.Body != "halo" {
		t.Fatal("body salah")
	}
	if p.Inbound.From.Phone == nil || *p.Inbound.From.Phone != "+628123" {
		t.Fatalf("phone salah: %v", p.Inbound.From.Phone)
	}
}

func TestParseApiCoInbound_SkipOutboundEcho(t *testing.T) {
	body := []byte(`{"event":"message.received","data":{"direction":"outbound","channel":"whatsapp"}}`)
	ev, _ := ParseApiCoEvent(body)
	if _, ok := ParseApiCoInbound(ev); ok {
		t.Fatal("echo outbound harus dilewati")
	}
}

func TestApiCoStatus(t *testing.T) {
	body := []byte(`{"event":"message.delivered","data":{"message_id":"msg_9","status":"delivered"}}`)
	ev, _ := ParseApiCoEvent(body)
	st, ok := ApiCoStatus(ev)
	if !ok {
		t.Fatal("harus dikenali status")
	}
	if st.Status != contracts.MessageStatusStatusDelivered {
		t.Fatalf("status = %q", st.Status)
	}
	if st.ProviderMessageId == nil || *st.ProviderMessageId != "msg_9" {
		t.Fatal("provider_message_id salah")
	}
	// message.received bukan status
	rev, _ := ParseApiCoEvent([]byte(`{"event":"message.received","data":{}}`))
	if _, ok := ApiCoStatus(rev); ok {
		t.Fatal("received bukan status")
	}
}

func TestApiCoChannelMapping(t *testing.T) {
	cases := []struct {
		ct contracts.ChannelType
		ch string
	}{
		{contracts.ChannelTypeWaOfficial, "whatsapp"},
		{contracts.ChannelTypeInstagram, "instagram"},
		{contracts.ChannelTypeFacebook, "messenger"},
	}
	for _, c := range cases {
		if got := apiCoChannel(c.ct); got != c.ch {
			t.Errorf("apiCoChannel(%s) = %q, mau %q", c.ct, got, c.ch)
		}
		if got := apiCoChannelType(c.ch); got != c.ct {
			t.Errorf("apiCoChannelType(%s) = %q, mau %q", c.ch, got, c.ct)
		}
	}
}

func TestRegistryGetFor(t *testing.T) {
	meta := NewMetaSender()
	apico := NewApiCoSender(contracts.ChannelTypeWaOfficial, "k", "")
	r := NewRegistry(meta, apico)

	// provider kosong → adapter default (Meta)
	if a, _ := r.GetFor("", contracts.ChannelTypeWaOfficial); a != Adapter(meta) {
		t.Fatal("provider kosong harus dapat MetaSender")
	}
	// provider apico → ApiCoSender
	if a, _ := r.GetFor(ProviderApiCo, contracts.ChannelTypeWaOfficial); a != Adapter(apico) {
		t.Fatal("provider apico harus dapat ApiCoSender")
	}
	// provider tak dikenal → fallback default
	if a, _ := r.GetFor("xxx", contracts.ChannelTypeWaOfficial); a != Adapter(meta) {
		t.Fatal("provider tak dikenal harus fallback Meta")
	}
}
