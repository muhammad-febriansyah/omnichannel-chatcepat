// Package queue owns Asynq task names and payloads. Business logic only depends
// on the small client/handler surface here, not on Redis primitives.
package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/hibiken/asynq"
)

const (
	QueueChannelEvents     = "channel:events"
	QueueAutomationProcess = "automation:process"
	QueueInstagramRead     = "instagram:read"
	QueueInstagramReply    = "instagram:reply"
	QueueInstagramMessage  = "instagram:message"
	QueueFacebookRead      = "facebook:read"
	QueueFacebookReply     = "facebook:reply"
	QueueFacebookMessage   = "facebook:message"
	QueueContactSync       = "contact:sync"
	TaskAutomationProcess  = QueueAutomationProcess
)

type TaskEnvelope struct {
	TaskID       string         `json:"task_id"`
	WorkspaceID  string         `json:"workspace_id"`
	ConnectionID string         `json:"connection_id"`
	Action       string         `json:"action"`
	Payload      map[string]any `json:"payload"`
	CreatedAt    string         `json:"created_at"`
}

type Client struct{ client *asynq.Client }

func NewClient(redisURL string) (*Client, error) {
	opt, err := redisOptions(redisURL)
	if err != nil {
		return nil, err
	}
	return &Client{client: asynq.NewClient(opt)}, nil
}

func (c *Client) Close() error { return c.client.Close() }

func (c *Client) EnqueueAutomation(ctx context.Context, envelope TaskEnvelope) error {
	payload, err := json.Marshal(envelope)
	if err != nil {
		return err
	}
	task := asynq.NewTask(TaskAutomationProcess, payload, asynq.TaskID(envelope.TaskID), asynq.MaxRetry(5), asynq.Queue(QueueAutomationProcess))
	_, err = c.client.EnqueueContext(ctx, task)
	return err
}

type Handler func(context.Context, TaskEnvelope) error

func RunWorker(redisURL string, concurrency int, handler Handler) error {
	opt, err := redisOptions(redisURL)
	if err != nil {
		return err
	}
	if concurrency < 1 {
		concurrency = 1
	}
	server := asynq.NewServer(opt, asynq.Config{Concurrency: concurrency, Queues: map[string]int{
		QueueChannelEvents:     1,
		QueueAutomationProcess: 5,
		QueueInstagramRead:     1,
		QueueInstagramReply:    1,
		QueueInstagramMessage:  1,
		QueueFacebookRead:      1,
		QueueFacebookReply:     1,
		QueueFacebookMessage:   1,
		QueueContactSync:       1,
	}})
	mux := asynq.NewServeMux()
	mux.HandleFunc(TaskAutomationProcess, func(ctx context.Context, task *asynq.Task) error {
		var envelope TaskEnvelope
		if err := json.Unmarshal(task.Payload(), &envelope); err != nil {
			return fmt.Errorf("decode automation task: %w", err)
		}
		return handler(ctx, envelope)
	})
	return server.Run(mux)
}

func redisOptions(redisURL string) (asynq.RedisClientOpt, error) {
	u, err := url.Parse(redisURL)
	if err != nil {
		return asynq.RedisClientOpt{}, fmt.Errorf("parse redis url: %w", err)
	}
	addr := u.Host
	if addr == "" {
		addr = "localhost:6379"
	}
	db := 0
	if raw := strings.Trim(u.Path, "/"); raw != "" {
		db, err = strconv.Atoi(raw)
		if err != nil {
			return asynq.RedisClientOpt{}, fmt.Errorf("parse redis db: %w", err)
		}
	}
	password := ""
	if u.User != nil {
		password, _ = u.User.Password()
	}
	return asynq.RedisClientOpt{Addr: addr, DB: db, Password: password}, nil
}
