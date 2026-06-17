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
from . import flow_engine


@dataclass
class Decision:
    replies: list[str] = field(default_factory=list)
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

    # 1. Flow (state lanjut atau trigger baru).
    outcome = await flow_engine.run(session, conv, channel, contact, inbound)
    if outcome is not None:
        return Decision(replies=outcome.replies, handoff=outcome.handoff)

    # 2. AI agent (bisa eskalasi ke agen kalau low-confidence).
    res = await ai.try_ai(session, conv, channel, contact, inbound)
    if res is not None:
        replies = [res.reply] if res.reply else []
        return Decision(replies=replies, handoff=res.handoff)

    # 3. Fallback default.
    return Decision(replies=[DEFAULT_FALLBACK_MESSAGE])
