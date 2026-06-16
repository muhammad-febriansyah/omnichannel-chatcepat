package channels

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/chatcepat/gateway/internal/contracts"
)

// Telegram adapter — Bot API sendMessage. Token bot di credentials["bot_token"].
type Telegram struct {
	http *http.Client
}

func NewTelegram() *Telegram {
	return &Telegram{http: &http.Client{Timeout: 15 * time.Second}}
}

func (t *Telegram) Type() contracts.ChannelType { return contracts.ChannelTypeTelegram }

func (t *Telegram) Send(ctx context.Context, cmd contracts.OutboundCommand, creds Credentials) (string, error) {
	token := creds.String("bot_token")
	if token == "" {
		return "", fmt.Errorf("telegram: bot_token kosong")
	}
	body := ""
	if cmd.Body != nil {
		body = *cmd.Body
	}
	form := url.Values{
		"chat_id": {cmd.To.ExternalId},
		"text":    {body},
	}
	endpoint := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := t.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var out struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageID int64 `json:"message_id"`
		} `json:"result"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if !out.OK {
		return "", fmt.Errorf("telegram: %s", out.Description)
	}
	return fmt.Sprintf("tg:%d", out.Result.MessageID), nil
}
