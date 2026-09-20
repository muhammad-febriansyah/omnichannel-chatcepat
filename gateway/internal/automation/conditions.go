package automation

import "strings"

type Condition struct {
	Type          string
	Operator      string
	Value         string
	CaseSensitive bool
}

func MatchConditions(text string, conditions []Condition) bool {
	for _, condition := range conditions {
		if !match(text, condition) {
			return false
		}
	}
	return true
}

func match(text string, condition Condition) bool {
	left, right := text, condition.Value
	if !condition.CaseSensitive {
		left, right = strings.ToLower(left), strings.ToLower(right)
	}
	switch condition.Operator {
	case "contains":
		return strings.Contains(left, right)
	case "equals":
		return left == right
	case "starts_with":
		return strings.HasPrefix(left, right)
	case "ends_with":
		return strings.HasSuffix(left, right)
	default:
		return false
	}
}
