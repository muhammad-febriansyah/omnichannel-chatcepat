package unofficial

// Client is the private boundary for a future, policy-compliant unofficial
// provider. It intentionally contains no scraping, stealth, proxy rotation,
// CAPTCHA/challenge bypass, or mass-engagement behavior.
type Client struct{}

func NewClient() *Client { return &Client{} }
