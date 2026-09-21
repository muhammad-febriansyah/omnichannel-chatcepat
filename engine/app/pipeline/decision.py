"""DECIDE — pilih balasan (node 'Cocokkan balasan'). Fallback chain docs/prd/06.

Urutan (berhenti di yang pertama menjawab), hanya saat handler != agent:
  1. FLOW (state lanjut / trigger keyword/welcome) — pipeline.flow_engine
  2. AI AGENT                                      — ai.agent
  3. FALLBACK                                      — pesan default
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from ..ai import agent as ai
from ..config import DEFAULT_FALLBACK_MESSAGE
from ..contracts.events import InboundMessage
from ..models import Channel, Contact, Conversation
from ..repositories import states
from . import flow_engine
from .reply import Reply, text_reply

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
    # Takeover dulu: agen pegang → bot diam (docs/prd/05).
    if conv.handler == "agent":
        return Decision(stop=True)

    enabled = getattr(channel, "auto_reply_enabled", True)
    if not enabled:
        return Decision(stop=True)
    mode = getattr(channel, "auto_reply_mode", "hybrid")

    # Saat channel dipindah ke AI-only, state menu lama tidak boleh hidup lagi
    # dan tiba-tiba dilanjutkan ketika mode menu diaktifkan kembali.
    if mode == "ai":
        active_state = await states.get(session, conv.id)
        if active_state is not None:
            await states.delete(session, conv.id)

    # 1. Flow (state lanjut atau trigger baru), kecuali channel AI-only.
    if mode != "ai":
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

    # Menu-only tidak boleh diam-diam jatuh ke AI.
    if mode == "menu":
        return Decision(replies=[text_reply(DEFAULT_FALLBACK_MESSAGE)])

    # 2. AI agent (bisa eskalasi ke agen kalau low-confidence).
    res = await ai.try_ai(session, conv, channel, contact, inbound)
    if res is not None:
        replies = [text_reply(res.reply)] if res.reply else []
        return Decision(replies=replies, handoff=res.handoff)

    # 3. Fallback default.
    return Decision(replies=[text_reply(DEFAULT_FALLBACK_MESSAGE)])
