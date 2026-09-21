package browser

import (
	"fmt"
	"path/filepath"
	"regexp"
)

var safeSegment = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

type Profile struct {
	Platform  string
	AccountID string
	Path      string
}

func NewProfile(root, platform, accountID string) (Profile, error) {
	if root == "" || !safeSegment.MatchString(platform) || !safeSegment.MatchString(accountID) {
		return Profile{}, ErrInvalidProfile
	}
	return Profile{
		Platform:  platform,
		AccountID: accountID,
		Path:      filepath.Join(root, platform, accountID),
	}, nil
}

func (p Profile) Validate() error {
	if p.Path == "" || !safeSegment.MatchString(p.Platform) || !safeSegment.MatchString(p.AccountID) {
		return ErrInvalidProfile
	}
	return nil
}

func (p Profile) String() string {
	return fmt.Sprintf("%s/%s", p.Platform, p.AccountID)
}
