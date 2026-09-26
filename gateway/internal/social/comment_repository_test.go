package social

import (
	"context"
	"os"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCommentActionsDeduplicateConcurrentAuthors(t *testing.T) {
	dsn := os.Getenv("SOCIAL_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set SOCIAL_TEST_DATABASE_URL to an isolated PostgreSQL database")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "social_test_" + uuid.NewString()[:8]
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE")
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	_, err = pool.Exec(ctx, `CREATE TABLE social_event_actions (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(), social_incoming_event_id uuid NOT NULL,
action_type text NOT NULL, dedupe_key text UNIQUE, UNIQUE(social_incoming_event_id, action_type))`)
	if err != nil {
		t.Fatal(err)
	}
	repo := NewRepository(pool)
	post := "https://instagram.com/p/post1/"
	base := IncomingSocialEvent{Platform: PlatformInstagram, AccountID: "account", SourceType: EventSourceComment, AuthorExternalID: "alice", TargetURL: &post}
	var winners atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			event := base
			event.ID = uuid.NewString()
			id, created, err := repo.CreateEventAction(ctx, event, ActionReplyComment)
			if err != nil {
				t.Error(err)
				return
			}
			if created {
				winners.Add(1)
				retryID, retryCreated, err := repo.CreateEventAction(ctx, event, ActionReplyComment)
				if err != nil || retryCreated || retryID != id {
					t.Errorf("same-event retry: id=%s created=%v err=%v", retryID, retryCreated, err)
				}
			} else if id != "" {
				t.Error("different comment may not recover another comment's job")
			}
		}()
	}
	wg.Wait()
	if winners.Load() != 1 {
		t.Fatalf("created %d duplicate actions", winners.Load())
	}
	for _, user := range []string{"bob", "carol"} {
		event := base
		event.ID = uuid.NewString()
		event.AuthorExternalID = user
		if _, created, err := repo.CreateEventAction(ctx, event, ActionReplyComment); err != nil || !created {
			t.Fatalf("different user dropped: created=%v err=%v", created, err)
		}
	}
	base.ID = uuid.NewString()
	if _, created, err := repo.CreateEventAction(ctx, base, ActionSendPrivateReply); err != nil || !created {
		t.Fatalf("private reply dropped: %v", err)
	}
}
