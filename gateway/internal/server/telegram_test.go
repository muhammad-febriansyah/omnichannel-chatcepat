package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/chatcepat/gateway/internal/channels"
	"github.com/chatcepat/gateway/internal/contracts"
)

type fakeResolver map[string]channels.ChannelInfo

func (f fakeResolver) Lookup(_ context.Context, id string) (channels.ChannelInfo, error) {
	info, ok := f[id]
	if !ok {
		return channels.ChannelInfo{}, errors.New("not found")
	}
	return info, nil
}

func (f fakeResolver) LookupByExternal(context.Context, contracts.ChannelType, string) (string, channels.ChannelInfo, error) {
	return "", channels.ChannelInfo{}, errors.New("not used")
}

// The Telegram webhook is public: it must refuse anything that is not a Telegram
// channel carrying the right secret, before a message reaches the bus.
func TestTelegramWebhookRejectsForgedRequests(t *testing.T) {
	s := &Server{Resolver: fakeResolver{
		"wa-1":        {Type: contracts.ChannelTypeWaOfficial, Credentials: channels.Credentials{}},
		"tg-nosecret": {Type: contracts.ChannelTypeTelegram, Credentials: channels.Credentials{}},
		"tg-1":        {Type: contracts.ChannelTypeTelegram, Credentials: channels.Credentials{"tg_secret": "s3cret"}},
	}}
	body := `{"message":{"message_id":1,"from":{"id":6281234567890,"first_name":"x"},"chat":{"id":6281234567890},"text":"hi"}}`

	cases := []struct {
		name, channel, secret string
		want                  int
	}{
		{"unknown channel", "nope", "s3cret", http.StatusNotFound},
		{"non-telegram channel", "wa-1", "", http.StatusNotFound},
		{"telegram without stored secret", "tg-nosecret", "", http.StatusUnauthorized},
		{"wrong secret", "tg-1", "guess", http.StatusUnauthorized},
		{"missing secret", "tg-1", "", http.StatusUnauthorized},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/webhooks/telegram/"+c.channel, strings.NewReader(body))
			if c.secret != "" {
				req.Header.Set("X-Telegram-Bot-Api-Secret-Token", c.secret)
			}
			rec := httptest.NewRecorder()
			s.handleTelegram(rec, req)
			if rec.Code != c.want {
				t.Fatalf("status = %d, want %d", rec.Code, c.want)
			}
		})
	}
}
