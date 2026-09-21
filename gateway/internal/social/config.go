package social

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	DatabaseURL         string
	RedisURL            string
	BrowserStoragePath  string
	BrowserHeadless     bool
	BrowserNoSandbox    bool
	AccountMinActionGap time.Duration
	ScannerInterval     time.Duration
	APIAuthToken        string
	AppEnv              string
}

func ConfigFromEnv() Config {
	return Config{
		DatabaseURL:         firstEnv("DATABASE_URL_SYNC", "DATABASE_URL"),
		RedisURL:            firstEnv("REDIS_URL", "redis://localhost:6379/0"),
		BrowserStoragePath:  firstEnv("BROWSER_STORAGE_PATH", "./storage/browser"),
		BrowserHeadless:     envBool("BROWSER_HEADLESS", false),
		BrowserNoSandbox:    envBool("BROWSER_NO_SANDBOX", true),
		AccountMinActionGap: time.Duration(envInt("ACCOUNT_MIN_ACTION_INTERVAL_SECONDS", 10)) * time.Second,
		ScannerInterval:     time.Duration(envInt("SOCIAL_SCANNER_INTERVAL_SECONDS", 60)) * time.Second,
		APIAuthToken:        os.Getenv("SOCIAL_API_TOKEN"),
		AppEnv:              firstEnv("APP_ENV", "development"),
	}
}

func firstEnv(primary, fallback string) string {
	if value := os.Getenv(primary); value != "" {
		return value
	}
	return os.Getenv(fallback)
}

func envBool(name string, fallback bool) bool {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt(name string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil || value < 1 {
		return fallback
	}
	return value
}
