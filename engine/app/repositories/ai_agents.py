"""AI agents + promos lookups (tenant-scoped)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AiAgent, AiAgentKnowledge, Promo


async def get(session: AsyncSession, tenant_id: uuid.UUID, agent_id: uuid.UUID) -> AiAgent | None:
    return await session.scalar(
        select(AiAgent).where(AiAgent.id == agent_id, AiAgent.tenant_id == tenant_id)
    )


async def resolve(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    agent_id: uuid.UUID | str | None = None,
    channel_agent_id: uuid.UUID | None = None,
) -> AiAgent | None:
    """Agent to answer with: explicit (flow node) → channel's agent → tenant default.

    Inactive agents are skipped so turning an agent off falls back gracefully.
    """
    if session is None:  # unit tests without a DB
        return None
    for candidate in (agent_id, channel_agent_id):
        if not candidate:
            continue
        try:
            cid = candidate if isinstance(candidate, uuid.UUID) else uuid.UUID(str(candidate))
        except ValueError:
            continue
        agent = await get(session, tenant_id, cid)
        if agent is not None and agent.is_active:
            return agent
    return await session.scalar(
        select(AiAgent).where(
            AiAgent.tenant_id == tenant_id, AiAgent.is_default.is_(True), AiAgent.is_active.is_(True)
        )
    )


async def document_ids(session: AsyncSession, tenant_id: uuid.UUID, agent_id: uuid.UUID) -> list[uuid.UUID]:
    if session is None:
        return []
    res = await session.scalars(
        select(AiAgentKnowledge.document_id).where(
            AiAgentKnowledge.tenant_id == tenant_id, AiAgentKnowledge.agent_id == agent_id
        )
    )
    return list(res)


async def active_promos(session: AsyncSession, tenant_id: uuid.UUID, now: datetime | None = None) -> list[Promo]:
    if session is None:
        return []
    now = now or datetime.now(timezone.utc)
    res = await session.scalars(
        select(Promo)
        .where(
            Promo.tenant_id == tenant_id,
            Promo.is_active.is_(True),
            or_(Promo.starts_at.is_(None), Promo.starts_at <= now),
            or_(Promo.ends_at.is_(None), Promo.ends_at >= now),
        )
        .order_by(Promo.ends_at.asc().nulls_last())
        .limit(10)
    )
    return list(res)
