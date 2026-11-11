"""What a tenant's plan allows, read at run time (flows, broadcasts).

The web checks the plan when something is saved; the engine checks it again when it
runs, so a tenant whose plan was downgraded or expired stops getting features it no
longer pays for. Mirrors web/lib/plan-config.ts (resolveEntitlements, TIER_DEFAULTS,
nodeAllowed) and web/lib/entitlements.ts (which plan row applies): keep them in sync.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

FEATURES = ("automation", "broadcast", "catalog", "reports", "multiNumber")

# Defaults per tier, used when a plan row has no value for a key (older rows).
TIER_DEFAULTS: dict[str, dict] = {
    "basic": {
        "features": {"automation": False, "broadcast": True, "catalog": False, "reports": False, "multiNumber": False},
        "broadcast_per_month": 2000,
    },
    "pro": {
        "features": {"automation": True, "broadcast": True, "catalog": True, "reports": True, "multiNumber": False},
        "broadcast_per_month": 10_000,
    },
    "business": {
        "features": {"automation": True, "broadcast": True, "catalog": True, "reports": True, "multiNumber": False},
        "broadcast_per_month": 10_000,
    },
    "enterprise": {
        "features": {"automation": True, "broadcast": True, "catalog": True, "reports": True, "multiNumber": True},
        "broadcast_per_month": None,
    },
}

_MISSING = object()


@dataclass(frozen=True)
class Entitlements:
    features: dict[str, bool]
    broadcast_per_month: int | None  # None = unlimited
    flow_nodes: tuple[str, ...] | None  # None = every flow step

    def node_allowed(self, kind: str) -> bool:
        # broadcast_message is governed by the "broadcast" feature, not the node list.
        return kind in ("trigger", "broadcast_message") or self.flow_nodes is None or kind in self.flow_nodes

    def flow_allowed(self, flow) -> bool:
        """Can this flow run on the plan: its feature, and every step in it."""
        feature = "broadcast" if flow.trigger == "broadcast" else "automation"
        if not self.features.get(feature, False):
            return False
        nodes = (flow.definition or {}).get("nodes", [])
        return all(self.node_allowed(str(n.get("type", ""))) for n in nodes)


def _limit(value, fallback: int | None) -> int | None:
    if value is None:
        return None  # stored null = unlimited
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
        return int(value)
    return fallback


def resolve(tier: str, row: dict | None) -> Entitlements:
    """Plan row (jsonb, possibly partial) + tier defaults → complete entitlements."""
    base = TIER_DEFAULTS.get(tier, TIER_DEFAULTS["basic"])
    if row is None:
        return Entitlements(dict(base["features"]), base["broadcast_per_month"], None)
    limits = row.get("limits") or {}
    flags = row.get("feature_flags") or {}
    features = {
        f: flags[f] if isinstance(flags.get(f), bool) else base["features"][f] for f in FEATURES
    }
    raw = limits.get("broadcastPerMonth", _MISSING)
    per_month = base["broadcast_per_month"] if raw is _MISSING else _limit(raw, base["broadcast_per_month"])
    nodes = row.get("flow_nodes")
    flow_nodes = tuple(str(n) for n in nodes) if isinstance(nodes, list) else None
    return Entitlements(features, per_month, flow_nodes)


# The plan a tenant is on: its linked plan while not expired, else the first active
# plan of its effective tier (an expired subscription drops to basic).
_TENANT = text(
    """
    SELECT plan_id,
           CASE WHEN plan_expires_at IS NOT NULL AND plan_expires_at < now()
                THEN 'basic' ELSE plan::text END AS tier,
           plan_expires_at IS NOT NULL AND plan_expires_at < now() AS expired
    FROM tenants WHERE id = :tenant_id
    """
)
_PLAN_BY_ID = text("SELECT limits, feature_flags, flow_nodes FROM plans WHERE id = :id")
_PLAN_BY_TIER = text(
    """
    SELECT limits, feature_flags, flow_nodes FROM plans
    WHERE tier::text = :tier AND is_active ORDER BY sort_order LIMIT 1
    """
)


async def for_tenant(session: AsyncSession, tenant_id: uuid.UUID) -> Entitlements:
    t = (await session.execute(_TENANT, {"tenant_id": tenant_id})).mappings().first()
    if t is None:
        return resolve("basic", None)
    row = None
    if t["plan_id"] is not None and not t["expired"]:
        row = (await session.execute(_PLAN_BY_ID, {"id": t["plan_id"]})).mappings().first()
    if row is None:
        row = (await session.execute(_PLAN_BY_TIER, {"tier": t["tier"]})).mappings().first()
    return resolve(t["tier"], dict(row) if row is not None else None)
