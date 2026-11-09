from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Flow


async def get(
    session: AsyncSession, flow_id: uuid.UUID, tenant_id: uuid.UUID | None = None
) -> Flow | None:
    stmt = select(Flow).where(Flow.id == flow_id)
    if tenant_id is not None:
        stmt = stmt.where(Flow.tenant_id == tenant_id)
    return await session.scalar(stmt)


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


def _channel_ok(flow: Flow, channel_id: uuid.UUID | None) -> bool:
    """Trigger limited to some accounts (trigger.channels) → only those channels."""
    node = _trigger_node(flow) or {}
    allowed = [str(c) for c in (node.get("trigger", {}).get("channels") or [])]
    return not allowed or channel_id is None or str(channel_id) in allowed


def _match_comment(active: list[Flow], text: str, post_id: str) -> Flow | None:
    """Comment flows: keyword filter (empty = every comment) + optional post filter.
    A flow with keywords wins over a catch-all one."""
    catch_all: Flow | None = None
    for flow in active:
        node = _trigger_node(flow) or {}
        trig = node.get("trigger", {})
        if (trig.get("kind") or flow.trigger) != "comment":
            continue
        posts = [str(p).strip() for p in trig.get("posts") or [] if str(p).strip()]
        # FB post ids are "<page>_<post>"; accept either form.
        if posts and not any(post_id == p or post_id.endswith("_" + p) for p in posts):
            continue
        words = [w.lower() for w in trig.get("match", []) if str(w).strip()]
        if not words:
            catch_all = catch_all or flow
        elif any(w in text for w in words):
            return flow
    return catch_all


def welcome_matches(trig: dict, is_first: bool, idle_hours: float | None) -> bool:
    """"Awal percakapan": the first message, or — when the trigger sets idle_hours —
    the first message after the customer was quiet that long (greet returning
    customers again instead of the default reply)."""
    if is_first:
        return True
    try:
        limit = float(trig.get("idle_hours") or 0)
    except (TypeError, ValueError):
        return False
    return limit > 0 and idle_hours is not None and idle_hours >= limit


async def match_trigger(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    body: str,
    is_first: bool,
    preferred_flow_id: uuid.UUID | None = None,
    button_text: str | None = None,
    channel_id: uuid.UUID | None = None,
    comment_post_id: str | None = None,
    idle_hours: float | None = None,
) -> Flow | None:
    """Cari flow aktif yang trigger-nya cocok. Urutan: klik tombol (label persis) →
    keyword (substring) → welcome (pesan pertama) → fallback.

    idle_hours = jam sejak pesan masuk sebelumnya di percakapan ini (None = belum ada).
    Komentar postingan (comment_post_id diisi) hanya cocok ke pemicu "comment".
    Pemicu dengan daftar `channels` hanya berlaku untuk akun/channel itu."""
    text = (body or "").lower()
    clicked = " ".join((button_text or "").casefold().split())
    welcome: Flow | None = None
    fallback: Flow | None = None
    active = [f for f in await list_active(session, tenant_id) if _channel_ok(f, channel_id)]
    if comment_post_id is not None:
        return _match_comment(active, text, comment_post_id)
    if preferred_flow_id is not None:
        preferred = next((f for f in active if f.id == preferred_flow_id), None)
        if preferred is not None:
            active = [preferred] + [f for f in active if f.id != preferred.id]
    if clicked:
        for flow in active:
            node = _trigger_node(flow) or {}
            trig = node.get("trigger", {})
            if (trig.get("kind") or flow.trigger) == "button":
                labels = {" ".join(str(w).casefold().split()) for w in trig.get("match", [])}
                if clicked in labels:
                    return flow
    for flow in active:
        node = _trigger_node(flow)
        if node is None:
            continue
        trig = node.get("trigger", {})
        kind = trig.get("kind") or flow.trigger
        if kind == "keyword":
            words = [w.lower() for w in trig.get("match", [])]
            if words and any(w in text for w in words):
                return flow
        elif kind == "welcome" and welcome_matches(trig, is_first, idle_hours):
            welcome = welcome or flow
        elif kind == "fallback":
            fallback = fallback or flow
    return welcome or fallback
