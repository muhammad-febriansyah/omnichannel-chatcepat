"""Flow executor — state machine deterministik atas flows.definition (docs/prd/06).

Node: trigger, send_text, send_media, send_catalog, wait_reply, condition, set_var,
call_tool, ai_agent, handoff. Posisi disimpan di conversation_states (05).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import agent as ai
from ..config import DEFAULT_FALLBACK_MESSAGE, FLOW_STATE_TTL_HOURS
from ..contracts.events import InboundMessage
from ..models import Channel, Contact, Conversation
from ..repositories import flows, messages, products, states
from .reply import Reply

_VAR = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
_MAX_STEPS = 100
# Maks produk dikirim satu node send_catalog (hindari spam → rawan banned).
_CATALOG_MAX = 10


def _rupiah(n: int) -> str:
    return "Rp" + f"{n:,}".replace(",", ".")


def product_caption(p) -> str:
    """Caption foto produk: nama, harga, (stok habis?), deskripsi singkat."""
    lines = [f"*{p.name}* — {_rupiah(p.price_idr)}"]
    if p.stock <= 0:
        lines.append("(stok habis)")
    if p.description:
        lines.append(p.description.strip())
    return "\n".join(lines)


@dataclass
class FlowOutcome:
    replies: list[Reply] = field(default_factory=list)
    handoff: bool = False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def render(text: str, ctx: dict) -> str:
    return _VAR.sub(lambda m: str(ctx.get(m.group(1), "")), text or "")


def eval_expr(expr: str, ctx: dict) -> bool:
    """Evaluator aman: dukung `lhs == rhs` / `lhs != rhs`. lhs = var; rhs = literal/var."""
    for op in ("==", "!="):
        if op in expr:
            lhs, rhs = (s.strip() for s in expr.split(op, 1))
            left = str(ctx.get(lhs, ""))
            if (rhs.startswith("'") and rhs.endswith("'")) or (
                rhs.startswith('"') and rhs.endswith('"')
            ):
                right = rhs[1:-1]
            else:
                right = str(ctx.get(rhs, ""))
            return left == right if op == "==" else left != right
    return False


def _nodes(flow) -> dict[str, dict]:
    return {n["id"]: n for n in (flow.definition or {}).get("nodes", [])}


async def _walk(
    session: AsyncSession,
    conv: Conversation,
    channel: Channel,
    contact: Contact,
    inbound: InboundMessage,
    flow,
    node_id: str | None,
    ctx: dict,
    outcome: FlowOutcome,
) -> tuple[str | None, bool]:
    """Jalankan node mulai node_id. Return (wait_node_id|None, ended)."""
    nodes = _nodes(flow)
    steps = 0
    while node_id is not None and steps < _MAX_STEPS:
        steps += 1
        node = nodes.get(node_id)
        if node is None:
            return None, True
        ntype = node.get("type")

        if ntype == "trigger":
            node_id = node.get("next")
        elif ntype == "send_text":
            outcome.replies.append(Reply(text=render(node.get("text", ""), ctx)))
            node_id = node.get("next")
        elif ntype == "send_media":
            url = render(node.get("url") or node.get("media_url") or "", ctx)
            caption = render(node.get("caption", ""), ctx) or None
            if url:
                outcome.replies.append(Reply(text=caption, media_url=url))
            elif caption:
                outcome.replies.append(Reply(text=caption))
            node_id = node.get("next")
        elif ntype == "send_catalog":
            await _send_catalog(session, conv, node, ctx, outcome)
            node_id = node.get("next")
        elif ntype == "set_var":
            ctx.update(node.get("set", {}))
            node_id = node.get("next")
        elif ntype == "condition":
            node_id = _branch(node, ctx)
        elif ntype == "call_tool":
            # TODO(06): eksekusi tool tenant (cek_ongkir, buat_invoice, dst).
            if node.get("save_as"):
                ctx[node["save_as"]] = ""
            node_id = node.get("next")
        elif ntype == "ai_agent":
            res = await ai.try_ai(session, conv, channel, contact, inbound)
            if res is None:
                outcome.replies.append(Reply(text=DEFAULT_FALLBACK_MESSAGE))
            else:
                if res.reply:
                    outcome.replies.append(Reply(text=res.reply))
                if res.handoff:
                    outcome.handoff = True
                    return None, True
            node_id = node.get("next")
        elif ntype == "wait_reply":
            return node_id, False  # PAUSE di sini
        elif ntype == "handoff":
            outcome.handoff = True
            return None, True
        else:
            node_id = node.get("next")

    return None, True


def _branch(node: dict, ctx: dict) -> str | None:
    for b in node.get("branches", []):
        if eval_expr(b.get("if", ""), ctx):
            return b.get("next")
    return node.get("else")


async def _send_catalog(
    session: AsyncSession,
    conv: Conversation,
    node: dict,
    ctx: dict,
    outcome: FlowOutcome,
) -> None:
    """Node send_catalog: kirim produk aktif sbg foto+caption. Opsi node: intro (teks
    pembuka), category (filter), limit (default 10, dibatasi _CATALOG_MAX)."""
    intro = render(node.get("intro", ""), ctx).strip()
    if intro:
        outcome.replies.append(Reply(text=intro))

    category = (node.get("category") or "").strip() or None
    try:
        limit = int(node.get("limit", _CATALOG_MAX))
    except (TypeError, ValueError):
        limit = _CATALOG_MAX
    limit = max(1, min(limit, _CATALOG_MAX))

    items = await products.list_active(
        session, conv.tenant_id, category=category, limit=limit
    )
    if not items:
        outcome.replies.append(Reply(text="Maaf, katalog belum tersedia saat ini."))
        return
    for p in items:
        caption = product_caption(p)
        photo = p.photos[0] if p.photos else None
        outcome.replies.append(Reply(text=caption, media_url=photo))


async def _persist_or_clear(
    session: AsyncSession,
    conv: Conversation,
    flow,
    wait_node: str | None,
    ctx: dict,
) -> None:
    if wait_node is not None:
        await states.upsert(
            session,
            tenant_id=conv.tenant_id,
            conversation_id=conv.id,
            flow_id=flow.id,
            current_node_id=wait_node,
            context=ctx,
            expires_at=_now() + timedelta(hours=FLOW_STATE_TTL_HOURS),
        )
    else:
        await states.delete(session, conv.id)


async def run(
    session: AsyncSession,
    conv: Conversation,
    channel: Channel,
    contact: Contact,
    inbound: InboundMessage,
) -> FlowOutcome | None:
    """Lanjut flow aktif atau mulai flow baru via trigger. None = tak ada flow (→ AI/fallback)."""
    body = inbound.body or ""
    outcome = FlowOutcome()

    state = await states.get(session, conv.id)
    if state is not None:
        expired = state.expires_at is not None and state.expires_at <= _now()
        flow = None if expired else await flows.get(session, state.flow_id)
        if flow is None or state.current_node_id is None:
            await states.delete(session, conv.id)
        else:
            # RESUME: simpan jawaban ke save_as lalu lanjut dari node berikutnya.
            ctx = dict(state.context or {})
            wait_node = _nodes(flow).get(state.current_node_id)
            if wait_node and wait_node.get("save_as"):
                ctx[wait_node["save_as"]] = body
            next_id = wait_node.get("next") if wait_node else None
            wait, _ended = await _walk(
                session, conv, channel, contact, inbound, flow, next_id, ctx, outcome
            )
            await _persist_or_clear(session, conv, flow, wait, ctx)
            return outcome

    # Tak ada state → cocokkan trigger.
    is_first = (await messages.count_inbound(session, conv.id)) <= 1
    flow = await flows.match_trigger(session, conv.tenant_id, body, is_first)
    if flow is None:
        return None

    nodes = _nodes(flow)
    trigger = next((n for n in nodes.values() if n.get("type") == "trigger"), None)
    start_id = trigger.get("next") if trigger else None
    ctx: dict = {"nama": contact.name or ""}
    wait, _ended = await _walk(
        session, conv, channel, contact, inbound, flow, start_id, ctx, outcome
    )
    await _persist_or_clear(session, conv, flow, wait, ctx)
    return outcome
