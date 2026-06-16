from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Flow


async def get(session: AsyncSession, flow_id: uuid.UUID) -> Flow | None:
    return await session.scalar(select(Flow).where(Flow.id == flow_id))


async def list_active(session: AsyncSession, tenant_id: uuid.UUID) -> list[Flow]:
    res = await session.scalars(
        select(Flow).where(Flow.tenant_id == tenant_id, Flow.status == "active")
    )
    return list(res)


def _trigger_node(flow: Flow) -> dict | None:
    for node in (flow.definition or {}).get("nodes", []):
        if node.get("type") == "trigger":
            return node
    return None


async def match_trigger(
    session: AsyncSession, tenant_id: uuid.UUID, body: str, is_first: bool
) -> Flow | None:
    """Cari flow aktif yang trigger-nya cocok dgn pesan (keyword) atau welcome (pesan pertama)."""
    text = (body or "").lower()
    welcome: Flow | None = None
    for flow in await list_active(session, tenant_id):
        node = _trigger_node(flow)
        if node is None:
            continue
        trig = node.get("trigger", {})
        kind = trig.get("kind") or flow.trigger
        if kind == "keyword":
            words = [w.lower() for w in trig.get("match", [])]
            if words and any(w in text for w in words):
                return flow
        elif kind == "welcome" and is_first:
            welcome = welcome or flow
    return welcome
