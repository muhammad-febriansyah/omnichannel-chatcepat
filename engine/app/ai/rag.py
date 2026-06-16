"""RAG retrieval dari knowledge_chunks (pgvector). docs/prd/06.

Filter tenant_id DULU lalu vector search — jangan bocor lintas tenant.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import KnowledgeChunk


async def retrieve(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    query_vec: list[float],
    k: int,
) -> list[KnowledgeChunk]:
    stmt = (
        select(KnowledgeChunk)
        .where(KnowledgeChunk.tenant_id == tenant_id)
        .order_by(KnowledgeChunk.embedding.cosine_distance(query_vec))
        .limit(k)
    )
    res = await session.scalars(stmt)
    return list(res)
