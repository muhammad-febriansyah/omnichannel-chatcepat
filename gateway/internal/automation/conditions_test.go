package automation

import "testing"

func TestMatchConditions(t *testing.T) {
	if !MatchConditions("Mau dong", []Condition{{Operator: "contains", Value: "mau"}}) {
		t.Fatal("expected case-insensitive contains to match")
	}
	if MatchConditions("Mau dong", []Condition{{Operator: "equals", Value: "mau"}}) {
		t.Fatal("expected equals to reject a longer value")
	}
	if !MatchConditions("Mau dong", []Condition{{Operator: "starts_with", Value: "Mau", CaseSensitive: true}}) {
		t.Fatal("expected starts_with to match")
	}
}
