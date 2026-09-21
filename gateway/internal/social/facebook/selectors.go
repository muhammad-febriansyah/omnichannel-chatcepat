package facebook

var selectors = struct {
	CommentNodes   []string
	MessageNodes   []string
	SessionMarkers []string
	PostLinks      []string
	CommentInput   []string
	MessageInput   []string
	Submit         []string
	Reply          []string
	PrivateReply   []string
}{
	CommentNodes: []string{
		"[data-comment-id]",
		"div[role='article'][data-comment-id]",
	},
	SessionMarkers: []string{
		"div[role='feed']",
		"a[href*='/messages/']",
		"a[aria-label*='Account' i]",
		"div[role='navigation']",
	},
	PostLinks: []string{
		"a[href*='/posts/']",
		"a[href*='/permalink/']",
		"a[href*='/photos/']",
	},
	MessageNodes: []string{
		"[data-message-id]",
		"div[role='main'] [data-id]",
	},
	CommentInput: []string{
		"textarea[aria-label*='comment' i]",
		"textarea[placeholder*='comment' i]",
		"div[role='textbox'][contenteditable='true']",
	},
	MessageInput: []string{
		"textarea[aria-label*='message' i]",
		"textarea[placeholder*='message' i]",
		"div[role='textbox'][contenteditable='true']",
	},
	Submit: []string{
		"button[type='submit']",
		"button[aria-label*='post' i]",
		"button[aria-label*='send' i]",
	},
	Reply: []string{
		"button[aria-label*='reply' i]",
		"button:has-text('Reply')",
	},
	PrivateReply: []string{
		"button[aria-label*='message' i]",
		"button:has-text('Message')",
	},
}
