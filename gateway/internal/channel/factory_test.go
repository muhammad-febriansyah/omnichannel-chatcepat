package channel

import "testing"

func TestOfficialDriversAreDisabledUntilReady(t *testing.T) {
	if err := ValidateDriver("official"); err == nil {
		t.Fatal("official driver must remain hidden and disabled")
	}
	for _, driver := range []string{"mock", "unofficial"} {
		if err := ValidateDriver(driver); err != nil {
			t.Fatalf("driver %q should be available: %v", driver, err)
		}
	}
}
