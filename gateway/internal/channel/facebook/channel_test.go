package facebook

import "testing"

func TestNewFacebookDriversStayBehindChannelBoundary(t *testing.T) {
	for _, driver := range []string{"mock", "unofficial"} {
		adapter, err := New(driver)
		if err != nil {
			t.Fatalf("driver %q: %v", driver, err)
		}
		if adapter.Name() == "" {
			t.Fatalf("driver %q returned an unnamed adapter", driver)
		}
	}
}

func TestNewFacebookRejectsUnknownDriver(t *testing.T) {
	for _, driver := range []string{"unknown", "official"} {
		if _, err := New(driver); err == nil {
			t.Fatalf("disabled Facebook driver %q must be rejected", driver)
		}
	}
}
