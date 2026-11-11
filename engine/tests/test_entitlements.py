"""Engine-side plan rules: must match web/lib/plan-config.ts."""

from types import SimpleNamespace

from app.repositories.entitlements import resolve


def flow(trigger, *node_types):
    return SimpleNamespace(
        trigger=trigger,
        definition={"nodes": [{"type": "trigger"}] + [{"type": t} for t in node_types]},
    )


def test_tier_defaults_when_no_plan_row():
    basic = resolve("basic", None)
    assert basic.features["automation"] is False
    assert basic.features["broadcast"] is True
    assert basic.broadcast_per_month == 2000
    assert resolve("enterprise", None).broadcast_per_month is None


def test_plan_row_overrides_defaults_and_null_means_unlimited():
    row = {
        "limits": {"broadcastPerMonth": None},
        "feature_flags": {"automation": True, "broadcast": False},
        "flow_nodes": ["send_text"],
    }
    ent = resolve("basic", row)
    assert ent.features["automation"] is True
    assert ent.features["broadcast"] is False
    assert ent.features["catalog"] is False  # missing flag → tier default
    assert ent.broadcast_per_month is None
    assert ent.flow_nodes == ("send_text",)


def test_missing_or_bad_limit_falls_back_to_tier():
    assert resolve("pro", {"limits": {}}).broadcast_per_month == 10_000
    assert resolve("pro", {"limits": {"broadcastPerMonth": -5}}).broadcast_per_month == 10_000


def test_automation_flow_blocked_without_feature():
    ent = resolve("basic", None)  # automation off, broadcast on
    assert not ent.flow_allowed(flow("keyword", "send_text"))
    assert ent.flow_allowed(flow("broadcast", "broadcast_message"))


def test_flow_with_step_outside_plan_is_blocked():
    ent = resolve("pro", {"flow_nodes": ["send_text"]})
    assert ent.flow_allowed(flow("keyword", "send_text"))
    assert not ent.flow_allowed(flow("keyword", "send_text", "ai_agent"))
    # broadcast_message is governed by the broadcast feature, not the step list
    assert ent.flow_allowed(flow("broadcast", "broadcast_message", "send_text"))
