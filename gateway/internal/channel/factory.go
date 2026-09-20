package channel

import "fmt"

func ValidateDriver(driver string) error {
	switch driver {
	case "mock", "unofficial":
		return nil
	default:
		return fmt.Errorf("unsupported or disabled channel driver %q", driver)
	}
}
