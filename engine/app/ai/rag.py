"""RAG retrieval from knowledge_chunks. docs/prd/06.

Always filter by tenant_id first so data never leaks across tenants.

Hybrid search: meaning (pgvector cosine distance, when an embedding is available)
plus keywords (chunk text contains the customer's words), merged with reciprocal-rank
fusion. Vector hits that are too far away are dropped unless the keywords also match,
so an unrelated chunk is never handed to the AI just because it was the "closest".
Without an embedding model (e.g. Anthropic) keyword search alone still works.
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
    "gimana", "bagaimana", "kapan", "dimana", "mana", "sih", "kah", "juga", "aja", "saja",
}

# Cosine distance above this = not about the question (text-embedding-3-small scale).
MAX_VECTOR_DISTANCE = 0.62
_RRF_K = 60


def keywords(text: str, limit: int = 8) -> list[str]:
    seen: list[str] = []
    for w in _WORD.findall((text or "").lower()):
        if w not in _STOP and w not in seen:
            seen.append(w)
    return seen[:limit]


def fuse(
    vector_hits: list[tuple[uuid.UUID, float]],
    keyword_hits: list[tuple[uuid.UUID, int]],
    k: int,
    max_distance: float = MAX_VECTOR_DISTANCE,
) -> list[uuid.UUID]:
    """Chunk ids by reciprocal-rank fusion. vector_hits = (id, distance) closest first,
    keyword_hits = (id, matched words) best first. Far vector hits only count when the
    keywords agree."""
    kw_ids = {cid for cid, _ in keyword_hits}
    score: dict[uuid.UUID, float] = {}
    rank = 0
    for cid, dist in vector_hits:
        if dist > max_distance and cid not in kw_ids:
            continue
        rank += 1
        score[cid] = score.get(cid, 0.0) + 1.0 / (_RRF_K + rank)
    for i, (cid, _) in enumerate(keyword_hits, 1):
        score[cid] = score.get(cid, 0.0) + 1.0 / (_RRF_K + i)
    return [cid for cid, _ in sorted(score.items(), key=lambda x: x[1], reverse=True)[:k]]


async def retrieve(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    query_vec: list[float] | None,
    k: int,
    *,
    document_ids: list[uuid.UUID] | None = None,
    query_text: str = "",
) -> list[KnowledgeChunk]:
    """Top-k relevant chunks. document_ids=None → whole KB; [] → nothing (agent has no docs)."""
    if session is None or (document_ids is not None and not document_ids):
        return []
    scope = [KnowledgeChunk.tenant_id == tenant_id]
    if document_ids is not None:
        scope.append(KnowledgeChunk.document_id.in_(document_ids))
    pool = k * 3

    vector_hits: list[tuple[uuid.UUID, float]] = []
    if query_vec is not None:
        distance = KnowledgeChunk.embedding.cosine_distance(query_vec)
        rows = await session.execute(
            select(KnowledgeChunk.id, distance)
            .where(*scope, KnowledgeChunk.embedding.is_not(None))
            .order_by(distance)
            .limit(pool)
        )
        vector_hits = [(cid, float(d)) for cid, d in rows]

    keyword_hits: list[tuple[uuid.UUID, int]] = []
    words = keywords(query_text)
    if words:
        score = sum(
            (case((func.lower(KnowledgeChunk.content).contains(w), literal(1)), else_=literal(0)) for w in words),
            literal(0),
        ).cast(Integer)
        rows = await session.execute(
            select(KnowledgeChunk.id, score).where(*scope, score > 0).order_by(score.desc()).limit(pool)
        )
        keyword_hits = [(cid, int(s)) for cid, s in rows]

    ids = fuse(vector_hits, keyword_hits, k)
    if not ids:
        return []
    found = {c.id: c for c in await session.scalars(select(KnowledgeChunk).where(KnowledgeChunk.id.in_(ids)))}
    return [found[i] for i in ids if i in found]
