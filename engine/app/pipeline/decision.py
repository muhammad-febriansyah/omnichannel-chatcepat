"""DECIDE — pilih balasan (node 'Cocokkan balasan'). Fallback chain docs/prd/06.

Urutan (berhenti di yang pertama menjawab), hanya saat handler != agent:
  1. FLOW (state lanjut / trigger tombol/keyword/welcome/cadangan) — pipeline.flow_engine.
     AI menjawab lewat node "AI Agent" di dalam flow (mis. flow Cadangan → AI).
  2. FALLBACK — pesan default
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import DEFAULT_FALLBACK_MESSAGE
from ..contracts.events import InboundMessage
from ..models import Channel, Contact, Conversation
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

    # 2. Fallback default.
    return Decision(replies=[text_reply(DEFAULT_FALLBACK_MESSAGE)])
