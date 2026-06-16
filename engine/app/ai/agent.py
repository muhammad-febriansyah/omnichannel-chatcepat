"""AI agent (docs/prd/06): RAG (pgvector) → prompt → LLM → guardrail.

Return teks balasan, atau None kalau AI nonaktif / tak bisa jawab (→ fallback).
Stateless per panggilan: konteks dibangun ulang dari DB tiap pesan.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import RAG_TOP_K
from ..contracts.events import InboundMessage
from ..models import Channel, Contact, Conversation
from . import rag
from .llm import get_provider

DEFAULT_PERSONA = (
    "Kamu asisten sales toko ini. Ramah, jelas, Bahasa Indonesia. "
    "Bantu pelanggan dan dorong penjualan tanpa memaksa."
)


async def try_ai(
    session: AsyncSession,
    conv: Conversation,
    channel: Channel,
    contact: Contact,
    inbound: InboundMessage,
) -> str | None:
    provider = get_provider()
    if provider is None or not getattr(provider, "enabled", False):
        return None

    query = (inbound.body or "").strip()
    if not query:
        return None

    # RAG: retrieve KB (filter tenant_id dulu).
    kb_context = ""
    try:
        vec = await provider.embed(query)
        chunks = await rag.retrieve(session, conv.tenant_id, vec, RAG_TOP_K)
        if chunks:
            kb_context = "\n\n".join(c.content for c in chunks)
    except NotImplementedError:
        pass  # provider tanpa embedding → jawab tanpa RAG

    persona = (channel.meta or {}).get("ai_persona") or DEFAULT_PERSONA
    system = persona
    if kb_context:
        system += f"\n\nPengetahuan (jawab hanya dari sini):\n{kb_context}"
    system += "\n\nGuardrail: jangan janji harga/stok di luar data. Kalau ragu, tawarkan bantuan agen."

    answer = (await provider.complete(system, query) or "").strip()
    # TODO(06): tool calling (cek_ongkir/buat_invoice/...), memory N pesan, eskalasi low-confidence.
    return answer or None
