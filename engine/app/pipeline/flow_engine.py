"""Flow executor — state machine deterministik atas flows.definition (docs/prd/06).

Node: trigger, send_text, send_media, send_catalog, wait_reply, condition, set_var,
call_tool, ai_agent, handoff, broadcast_message. Posisi disimpan di conversation_states (05).

broadcast_message = pesan pertama flow berpemicu "broadcast". Pesannya dikirim oleh
broadcast worker (services/broadcast.py), bukan di sini; flow menunggu di node ini dan
lanjut saat kontak membalas (teks → next) atau klik tombol template (→ cabang tombol).
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import agent as ai
from ..config import BROADCAST_FLOW_TTL_HOURS, DEFAULT_FALLBACK_MESSAGE, FLOW_STATE_TTL_HOURS
from ..contracts.events import InboundMessage
from ..models import Channel, Contact, Conversation, Tag
from ..repositories import broadcasts, flows, messages, products, states
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


def pick_text(node: dict) -> str:
    """Main text or one of its variants, at random. Several wordings for the same
    message keep repeated bot replies from looking copy-pasted (spam signal on
    WhatsApp / Meta) and read more natural to customers."""
    options = [str(t) for t in [node.get("text", ""), *(node.get("variants") or [])] if str(t).strip()]
    return random.choice(options) if options else ""


# Operator kata (dipakai node Kondisi di flow builder). Case-insensitive + trim.
_WORD_OP = re.compile(
    r"^\s*([a-zA-Z0-9_]+)\s+(equals|not_equals|contains|starts_with|is_empty|not_empty)\b\s*(.*)$",
    re.S,
)


def _operand(raw: str, ctx: dict) -> str:
    """Literal ber-kutip ('x' / "x") → isinya; selain itu dianggap nama variabel."""
    raw = raw.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
        return raw[1:-1]
    return str(ctx.get(raw, ""))


def _fold(value: str) -> str:
    return " ".join(str(value).casefold().split())


def eval_expr(expr: str, ctx: dict) -> bool:
    """Evaluator aman (tanpa eval). Sintaks:

    - `var == 'x'` / `var != 'x'` — banding persis (kompatibel flow lama).
    - `var equals 'x'`, `not_equals`, `contains`, `starts_with` — case-insensitive,
      spasi dirapikan.
    - `var is_empty` / `var not_empty` — tanpa operand kanan.
    rhs tanpa kutip = nama variabel lain.
    """
    expr = expr or ""
    m = _WORD_OP.match(expr)
    if m:
        lhs, op, rhs = m.group(1), m.group(2), m.group(3)
        left = _fold(ctx.get(lhs, ""))
        if op == "is_empty":
            return left == ""
        if op == "not_empty":
            return left != ""
        right = _fold(_operand(rhs, ctx))
        if op == "equals":
            return left == right
        if op == "not_equals":
            return left != right
        if op == "contains":
            return right != "" and right in left
        if op == "starts_with":
            return right != "" and left.startswith(right)
        return False
    for op in ("==", "!="):
        if op in expr:
            lhs, rhs = (s.strip() for s in expr.split(op, 1))
            left = str(ctx.get(lhs, ""))
            right = _operand(rhs, ctx)
            return left == right if op == "==" else left != right
    return False


async def _add_tags(session: AsyncSession, contact: Contact, tags: list) -> None:
    """Node Beri Tag: tambah tag ke kontak + daftarkan di master tag tenant."""
    clean = [str(t).strip().lower() for t in tags if str(t).strip()]
    if not clean:
        return
    contact.tags = sorted(set(contact.tags or []) | set(clean))
    existing = set(
        await session.scalars(
            select(Tag.name).where(Tag.tenant_id == contact.tenant_id, Tag.name.in_(clean))
        )
    )
    for name in clean:
        if name not in existing:
            session.add(Tag(tenant_id=contact.tenant_id, name=name))


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
            buttons = [
                (str(b.get("id", "")), render(str(b.get("title", "")), ctx))
                for b in node.get("buttons") or []
                if b.get("id") and b.get("title")
            ]
            outcome.replies.append(Reply(text=render(pick_text(node), ctx), buttons=buttons))
            node_id = node.get("next")
        elif ntype == "reply_comment":
            # Public reply under the comment. Several variants → pick one at random so
            # dozens of identical replies don't look like spam to Meta.
            texts = [t for t in (node.get("texts") or []) if str(t).strip()]
            if texts and getattr(inbound, "comment", None) is not None:
                outcome.replies.append(Reply(text=render(random.choice(texts), ctx), mode="comment_reply"))
            node_id = node.get("next")
        elif ntype == "private_reply":
            # One DM to the commenter. Outside a comment it is just a normal message.
            text = render(pick_text(node), ctx)
            if text.strip():
                mode = "private_reply" if getattr(inbound, "comment", None) is not None else None
                outcome.replies.append(Reply(text=text, mode=mode))
            node_id = node.get("next")
        elif ntype == "add_tag":
            await _add_tags(session, contact, node.get("tags") or [])
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
            res = await ai.try_ai(
                session,
                conv,
                channel,
                contact,
                inbound,
                agent_id=node.get("agent_id"),
                inline=node.get("ai") if isinstance(node.get("ai"), dict) else None,
            )
            if res is None:
                outcome.replies.append(Reply(text=DEFAULT_FALLBACK_MESSAGE))
            elif res.handoff and node.get("handoff_next"):
                # "Perlu CS" branch is wired: the flow decides what happens next
                # (e.g. ask for details, tag, then hand over) instead of the stock reply.
                node_id = node.get("handoff_next")
                continue
            else:
                if res.reply:
                    outcome.replies.append(Reply(text=res.reply))
                if res.handoff:
                    outcome.handoff = True
                    return None, True
            node_id = node.get("next")
        elif ntype in ("wait_reply", "broadcast_message"):
            # broadcast_message only sends from the broadcast worker; reaching it again
            # (a loop back) just waits for the next reply.
            return node_id, False  # PAUSE di sini
        elif ntype == "handoff":
            outcome.handoff = True
            return None, True
        else:
            node_id = node.get("next")

    return None, True


def broadcast_next(node: dict, button_index: int | None) -> str | None:
    """Step after a broadcast message: the tapped button's branch, else "next"."""
    if button_index is not None:
        for b in node.get("buttons") or []:
            try:
                if int(b.get("index", -1)) == button_index:
                    return b.get("next") or node.get("next")
            except (TypeError, ValueError):
                continue
    return node.get("next")


async def _continue_broadcast(
    session: AsyncSession,
    conv: Conversation,
    channel: Channel,
    contact: Contact,
    inbound: InboundMessage,
    flow,
    node: dict,
    ctx: dict,
    button_index: int | None,
    outcome: FlowOutcome,
) -> FlowOutcome:
    body = (inbound.body or "").strip()
    ctx["pesan"] = body
    if node.get("save_as"):
        ctx[node["save_as"]] = body
    if button_index is not None:
        ctx["tombol"] = body
    wait, _ended = await _walk(
        session, conv, channel, contact, inbound, flow,
        broadcast_next(node, button_index), ctx, outcome,
    )
    await _persist_or_clear(session, conv, flow, wait, ctx)
    return outcome


async def start_broadcast_state(
    session: AsyncSession, conv: Conversation, b, contact: Contact
) -> None:
    """Called by the broadcast worker after sending: park the conversation on the
    broadcast step so the contact's reply continues the flow."""
    await states.upsert(
        session,
        tenant_id=conv.tenant_id,
        conversation_id=conv.id,
        flow_id=b.flow_id,
        current_node_id=b.flow_node_id,
        context={"nama": contact.name or "", "broadcast_id": str(b.id)},
        expires_at=_now() + timedelta(hours=BROADCAST_FLOW_TTL_HOURS),
    )


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
    preferred_flow_id=None,
) -> FlowOutcome | None:
    """Lanjut flow aktif atau mulai flow baru via trigger. None = tak ada flow (→ AI/fallback)."""
    body = inbound.body or ""
    payload = getattr(inbound, "payload", None) or ""
    is_button = inbound.type.value == "interactive"
    # A tap on a broadcast button starts its own flow, even mid-conversation.
    broadcast_click = payload.startswith("bc:")
    comment = getattr(inbound, "comment", None)
    outcome = FlowOutcome()

    if comment is not None:
        # A comment never resumes a chat flow: it only starts a "comment" flow.
        flow = await flows.match_trigger(
            session,
            conv.tenant_id,
            body,
            False,
            channel_id=channel.id,
            comment_post_id=comment.post_id,
        )
        if flow is None:
            return None
        trigger = next((n for n in _nodes(flow).values() if n.get("type") == "trigger"), None)
        ctx: dict = {
            "nama": contact.name or "",
            "pesan": body.strip(),
            "komentar": body.strip(),
            "post_id": comment.post_id,
        }
        wait, _ended = await _walk(
            session, conv, channel, contact, inbound, flow,
            trigger.get("next") if trigger else None, ctx, outcome,
        )
        # Wait steps continue in DM once the commenter replies to the private reply.
        # No wait → leave any chat flow already running in this conversation alone.
        if wait is not None:
            await _persist_or_clear(session, conv, flow, wait, ctx)
        return outcome

    state = await states.get(session, conv.id)
    if broadcast_click:
        # Button on a flow broadcast → continue that flow from its broadcast step,
        # even when the waiting state expired or another flow ran in between.
        click = broadcasts.parse_click_payload(payload)
        b = await broadcasts.get(session, click[0]) if click else None
        if b is not None and b.tenant_id == conv.tenant_id and b.flow_id and b.flow_node_id:
            flow = await flows.get(session, b.flow_id, conv.tenant_id)
            node = _nodes(flow).get(b.flow_node_id) if flow and flow.status == "active" else None
            if node is not None:
                ctx = {"nama": contact.name or "", "broadcast_id": str(b.id)}
                if state is not None and state.flow_id == flow.id:
                    ctx = {**(state.context or {}), **ctx}
                return await _continue_broadcast(
                    session, conv, channel, contact, inbound, flow, node, ctx, click[1], outcome
                )
        # Old broadcast (no flow): the tap starts its own flow by button label.
        if state is not None:
            await states.delete(session, conv.id)
            state = None
    if state is not None:
        expired = state.expires_at is not None and state.expires_at <= _now()
        flow = None if expired else await flows.get(session, state.flow_id, conv.tenant_id)
        if flow is None or flow.status != "active" or state.current_node_id is None:
            await states.delete(session, conv.id)
        else:
            # RESUME: simpan jawaban ke save_as lalu lanjut dari node berikutnya.
            ctx = dict(state.context or {})
            ctx["pesan"] = body.strip()  # pesan terakhir pelanggan (dipakai node Kondisi)
            wait_node = _nodes(flow).get(state.current_node_id)
            if wait_node and wait_node.get("type") == "broadcast_message":
                # Free-text reply to a broadcast → "Balasan lain" / "Saat dibalas" branch.
                return await _continue_broadcast(
                    session, conv, channel, contact, inbound, flow, wait_node, ctx, None, outcome
                )
            if wait_node and wait_node.get("save_as"):
                # Tapped a menu button → its id (= option code) is the most reliable answer.
                value = (payload if payload and not broadcast_click else body).strip()
                if wait_node.get("normalize") == "choice":
                    value = " ".join(value.casefold().split())
                ctx[wait_node["save_as"]] = value
            next_id = wait_node.get("next") if wait_node else None
            wait, _ended = await _walk(
                session, conv, channel, contact, inbound, flow, next_id, ctx, outcome
            )
            await _persist_or_clear(session, conv, flow, wait, ctx)
            return outcome

    # Tak ada state → cocokkan trigger.
    is_first = (await messages.count_inbound(session, conv.id)) <= 1
    idle_hours = None
    if not is_first:
        prev = await messages.previous_inbound_at(session, conv.id)
        if prev is not None:
            idle_hours = (_now() - prev).total_seconds() / 3600
    flow = await flows.match_trigger(
        session,
        conv.tenant_id,
        body,
        is_first,
        preferred_flow_id=preferred_flow_id,
        button_text=body if is_button else None,
        channel_id=channel.id,
        idle_hours=idle_hours,
    )
    if flow is None:
        return None

    nodes = _nodes(flow)
    trigger = next((n for n in nodes.values() if n.get("type") == "trigger"), None)
    start_id = trigger.get("next") if trigger else None
    ctx: dict = {"nama": contact.name or "", "pesan": body.strip()}
    wait, _ended = await _walk(
        session, conv, channel, contact, inbound, flow, start_id, ctx, outcome
    )
    await _persist_or_clear(session, conv, flow, wait, ctx)
    return outcome
