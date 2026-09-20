package unofficial

// Client is the private boundary for a future, policy-compliant unofficial
// implementation. It intentionally contains no scraping or anti-detection code.
type Client struct{}

func NewClient() *Client { return &Client{} }
