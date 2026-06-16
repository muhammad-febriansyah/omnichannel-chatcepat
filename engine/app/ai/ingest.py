"""Knowledge base ingestion (docs/prd/06): teks → chunk → embed → knowledge_chunks.

Dipakai worker upload / endpoint reindex (09). Butuh LLM provider dgn embed().
"""

from __future__ import annotations

import uuid

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import KnowledgeChunk, KnowledgeDocument
from .llm import get_provider


def chunk_text(text: str, size: int = 500, overlap: int = 50) -> list[str]:
    """Pecah teks jadi potongan ~size karakter dgn sedikit overlap (jaga konteks)."""
    text = " ".join((text or "").split())
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + size, n)
        chunks.append(text[start:end])
        if end == n:
            break
        start = end - overlap
    return chunks


async def ingest(session: AsyncSession, document_id: uuid.UUID, raw_text: str) -> int:
    """Re-index satu dokumen. Return jumlah chunk. status → ready kalau berhasil."""
    doc = await session.get(KnowledgeDocument, document_id)
    if doc is None:
        raise ValueError(f"dokumen {document_id} tidak ada")

    provider = get_provider()
    if provider is None:
        raise RuntimeError("LLM provider (embedding) tidak dikonfigurasi")

    # Bersihkan chunk lama (idempoten utk reindex).
    await session.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document_id)
    )

    pieces = chunk_text(raw_text)
    for piece in pieces:
        embedding = await provider.embed(piece)
        session.add(
            KnowledgeChunk(
                tenant_id=doc.tenant_id,
                document_id=doc.id,
                content=piece,
                embedding=embedding,
                token_count=len(piece.split()),
            )
        )
    doc.status = "ready"
    await session.flush()
    return len(pieces)
