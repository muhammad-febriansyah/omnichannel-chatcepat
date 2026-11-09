"""RAG retrieval from knowledge_chunks. docs/prd/06.

Always filter by tenant_id first so data never leaks across tenants. Vector search
when an embedding is available; otherwise (e.g. Anthropic has no embedding API) a
keyword match over chunk text so the knowledge base still works.
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy import Integer, case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import KnowledgeChunk

_WORD = re.compile(r"[\w]{3,}", re.UNICODE)
# Very common Indonesian words that would match everything.
_STOP = {
    "yang", "dan", "untuk", "dengan", "ini", "itu", "ada", "apa", "bisa", "kak", "min",
    "saya", "aku", "kamu", "mau", "dong", "nya", "tidak", "gak", "nggak", "berapa", "kalau",
}


def keywords(text: str, limit: int = 8) -> list[str]:
    seen: list[str] = []
    for w in _WORD.findall((text or "").lower()):
        if w not in _STOP and w not in seen:
            seen.append(w)
    return seen[:limit]


async def retrieve(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    query_vec: list[float] | None,
    k: int,
    *,
    document_ids: list[uuid.UUID] | None = None,
    query_text: str = "",
) -> list[KnowledgeChunk]:
    """Top-k chunks. document_ids=None → whole KB; [] → nothing (agent has no docs)."""
    if session is None or (document_ids is not None and not document_ids):
        return []
    base = select(KnowledgeChunk).where(KnowledgeChunk.tenant_id == tenant_id)
    if document_ids is not None:
        base = base.where(KnowledgeChunk.document_id.in_(document_ids))

    if query_vec is not None:
        stmt = (
            base.where(KnowledgeChunk.embedding.is_not(None))
            .order_by(KnowledgeChunk.embedding.cosine_distance(query_vec))
            .limit(k)
        )
        found = list(await session.scalars(stmt))
        if found:
            return found

    words = keywords(query_text)
    if not words:
        return []
    score = sum(
        (case((func.lower(KnowledgeChunk.content).contains(w), literal(1)), else_=literal(0)) for w in words),
        literal(0),
    ).cast(Integer)
    stmt = base.where(score > 0).order_by(score.desc()).limit(k)
    return list(await session.scalars(stmt))
