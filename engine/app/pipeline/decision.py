"""DECIDE — pilih balasan (node 'Cocokkan balasan'). Fallback chain docs/prd/06.

Urutan (berhenti di yang pertama menjawab), hanya saat handler != agent:
  1. FLOW (state lanjut / trigger tombol/keyword/welcome/cadangan) — pipeline.flow_engine.
     AI menjawab lewat node "AI Agent" di dalam flow (mis. flow Cadangan → AI).
  2. FALLBACK — per channel (channels.fallback_action): 'ai' = asisten AI channel
     menjawab, 'message' = pesan tetap (channels.fallback_message / default),
     'silent' = diam, agen membalas manual.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import DEFAULT_FALLBACK_MESSAGE
from ..repositories import messages
from ..contracts.events import InboundMessage
from ..ai import agent as ai
from ..models import Channel, Contact, Conversation
from . import flow_engine
from .reply import Reply, text_reply

# Fixed fallback text is not repeated in a conversation within this many hours.
FALLBACK_REPEAT_HOURS = 12
# An agent who took over and then went quiet this long hands the chat back to the bot.
BOT_RESUME_HOURS = 3

__all__ = ["Decision", "Reply", "text_reply", "decide"]


@dataclass
class Decision:
    replies: list[Reply] = field(default_factory=list)
    handoff: bool = False  # eskalasi ke agen (set handler=agent)
    stop: bool = False  # agen sudah pegang → bot diam


async def decide(
    session: AsyncSession,
    conv: Conversation,
    channel: Channel,
    contact: Contact,
    inbound: InboundMessage,
) -> Decision:
    # Takeover dulu: agen pegang → bot diam (docs/prd/05). Kalau balasan terakhir
    # dari agen sudah lewat BOT_RESUME_HOURS, bot aktif lagi (agen lupa
    # "Kembalikan ke bot"). Handoff yang belum dibalas agen tetap ditunggu agen.
    if conv.handler == "agent":
        last = await messages.last_outbound(session, conv.id)
        if last is None or last[0] != "agent":
            return Decision(stop=True)
        sent_at = last[1] if last[1].tzinfo else last[1].replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - sent_at < timedelta(hours=BOT_RESUME_HOURS):
            return Decision(stop=True)
        conv.handler = "bot"

    enabled = getattr(channel, "auto_reply_enabled", True)
    if not enabled:
        return Decision(stop=True)

    # Public comments are answered only by a matching "Komentar" flow — never by the
    # default message (a stray public reply under every comment looks like spam).
    if getattr(inbound, "comment", None) is not None:
        outcome = await flow_engine.run(session, conv, channel, contact, inbound)
        if outcome is None:
            return Decision(stop=True)
        return Decision(replies=outcome.replies, handoff=outcome.handoff)

    # 1. Flow (state lanjut atau trigger baru). AI lives inside flows as the
    #    "AI Agent" node — a "Cadangan" flow with AI replaces the old AI Default.
    outcome = await flow_engine.run(
        session,
        conv,
        channel,
        contact,
        inbound,
        preferred_flow_id=getattr(channel, "default_flow_id", None),
    )
    if outcome is not None:
        return Decision(replies=outcome.replies, handoff=outcome.handoff)

    # 2. Nothing matched → what this channel chose.
    action = getattr(channel, "fallback_action", None) or "message"
    if action == "silent":
        return Decision(stop=True)
    if action == "ai":
        res = await ai.try_ai(session, conv, channel, contact, inbound)
        if res is not None:
            return Decision(replies=[text_reply(res.reply)] if res.reply else [], handoff=res.handoff)
        # AI unavailable (no model configured, media-only message) → fixed text below.
    text = (getattr(channel, "fallback_message", None) or "").strip() or DEFAULT_FALLBACK_MESSAGE
    # The same fixed text on every message looks like a bot (spam signal on WhatsApp)
    # and burns the unofficial daily cap: send it once per conversation per window.
    since = datetime.now(timezone.utc) - timedelta(hours=FALLBACK_REPEAT_HOURS)
    if await messages.bot_sent_text_since(session, conv.id, text, since):
        return Decision(stop=True)
    return Decision(replies=[text_reply(text)])
