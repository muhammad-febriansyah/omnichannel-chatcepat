package instagram

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
		"article[data-comment-id]",
	},
	SessionMarkers: []string{
		"a[href*='/direct/']",
		"a[href*='/accounts/edit/']",
		"svg[aria-label*='Home' i]",
		"nav",
	},
	PostLinks: []string{
		"a[href*='/p/']",
		"a[href*='/reel/']",
		"a[href*='/tv/']",
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
		"[role='button'][aria-label*='reply' i]",
		"button[aria-label*='balas' i]",
	},
	PrivateReply: []string{
		"button[aria-label*='message' i]",
		"[role='button'][aria-label*='message' i]",
		"button[aria-label*='pesan' i]",
	},
}
