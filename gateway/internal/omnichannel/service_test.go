package omnichannel

import "testing"

func TestIdempotencyKeyIsStableAndScoped(t *testing.T) {
	first := idempotencyKey("run-1", "action-1", "comment-1")
	second := idempotencyKey("run-1", "action-1", "comment-1")
	if first != second {
		t.Fatal("same action inputs must produce the same idempotency key")
	}
	if first == idempotencyKey("run-1", "action-2", "comment-1") {
		t.Fatal("different actions must not share an idempotency key")
	}
}
