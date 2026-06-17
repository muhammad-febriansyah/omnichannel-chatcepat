"""AI agent (docs/prd/06): memori → RAG (pgvector) → prompt → LLM → guardrail.

`try_ai` mengembalikan AIResult (reply + flag handoff), atau None kalau AI nonaktif /
tak bisa jawab (→ fallback). Konteks percakapan dibangun ulang dari DB tiap pesan.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import AI_ESCALATION_MESSAGE, AI_HISTORY_LIMIT, RAG_TOP_K
from ..contracts.events import InboundMessage
from ..models import Channel, Contact, Conversation
from ..repositories import messages as messages_repo
from . import rag
from .llm import Turn, get_provider

DEFAULT_PERSONA = (
    "Kamu asisten sales toko ini. Ramah, jelas, Bahasa Indonesia. "
    "Bantu pelanggan dan dorong penjualan tanpa memaksa."
)

# Sentinel yang diminta dari model saat ia angkat tangan (low-confidence / minta
# manusia / keluhan sensitif). Dideteksi di sini → handoff ke agen.
_HANDOFF_SENTINEL = "[[HANDOFF]]"

_GUARDRAIL = (
    "\n\nGuardrail: jangan janji harga/stok/promo di luar data yang diberikan. "
    f"Kalau kamu tidak yakin, pertanyaan di luar wewenangmu, pelanggan minta bicara "
    f"dengan manusia/agen, atau ini keluhan serius — balas PERSIS '{_HANDOFF_SENTINEL}' "
    "tanpa teks lain, supaya dialihkan ke agen."
)


@dataclass
class AIResult:
    reply: str | None = None
    handoff: bool = False  # eskalasi ke agen manusia (set conv.handler=agent)


async def _build_history(
    session: AsyncSession, conv: Conversation, query: str
) -> list[Turn]:
    """Memori N pesan terakhir → daftar Turn (urut lama→baru), tanpa query terkini."""
    msgs = await messages_repo.recent_turns(session, conv.id, AI_HISTORY_LIMIT)
    # Buang turn terakhir bila duplikat dari query inbound terkini (sudah di-persist).
    if msgs and msgs[-1].direction == "inbound" and (msgs[-1].body or "").strip() == query:
        msgs = msgs[:-1]
    history: list[Turn] = []
    for m in msgs:
        body = (m.body or "").strip()
        if not body:
            continue
        role = "user" if m.direction == "inbound" else "assistant"
        history.append({"role": role, "content": body})
    return history


async def try_ai(
    session: AsyncSession,
    conv: Conversation,
    channel: Channel,
    contact: Contact,
    inbound: InboundMessage,
) -> AIResult | None:
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
    system += _GUARDRAIL

    history = await _build_history(session, conv, query)
    answer = (await provider.complete(system, query, history) or "").strip()

    # Low-confidence escalation: model minta handoff → diam-diam alihkan ke agen.
    if _HANDOFF_SENTINEL in answer:
        return AIResult(reply=AI_ESCALATION_MESSAGE, handoff=True)

    # TODO(06): tool calling untuk integrasi nyata tenant (cek_ongkir/buat_invoice)
    # — butuh backend per-tenant + loop tool-use spesifik provider; belum ada.
    if not answer:
        return None
    return AIResult(reply=answer)
