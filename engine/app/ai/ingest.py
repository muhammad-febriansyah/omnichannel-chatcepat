"""Knowledge base ingestion (docs/prd/06): teks → chunk → embed → knowledge_chunks.

Dipakai worker upload / endpoint reindex (09). Embedding dipotong dari token AI tenant.
"""

from __future__ import annotations

import re
import uuid

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import KnowledgeChunk, KnowledgeDocument
from . import metered


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


CHUNK_SIZE = 900
_HEADING = re.compile(r"^\s*(#{1,6})\s+(.+?)\s*#*\s*$")
_SENTENCE = re.compile(r"(?<=[.!?])\s+")


def _heading(line: str) -> str | None:
    """Markdown heading, or a short ALL-CAPS title line."""
    m = _HEADING.match(line)
    if m:
        return m.group(2).strip()
    t = line.strip().rstrip(":")
    if 3 < len(t) <= 60 and t.isupper() and any(c.isalpha() for c in t):
        return t.title()
    return None


def _split_long(paragraph: str, size: int) -> list[str]:
    """A paragraph bigger than one chunk → sentence groups (hard cut as a last resort)."""
    out, cur = [], ""
    for sentence in _SENTENCE.split(paragraph):
        while len(sentence) > size:
            out.append(sentence[:size])
            sentence = sentence[size:]
        if cur and len(cur) + 1 + len(sentence) > size:
            out.append(cur)
            cur = sentence
        else:
            cur = f"{cur} {sentence}".strip()
    if cur:
        out.append(cur)
    return out


def chunk_sections(text: str, title: str = "", size: int = CHUNK_SIZE) -> list[str]:
    """Chunks that follow the document's own structure: split at headings, keep
    paragraphs whole where possible, and prefix each chunk with "[title › section]" so
    a chunk read alone still says what it is about."""
    sections: list[tuple[str, list[str]]] = [("", [])]
    para: list[str] = []

    def end_para():
        if para:
            sections[-1][1].append(" ".join(para))
            para.clear()

    for line in (text or "").splitlines():
        h = _heading(line)
        if h:
            end_para()
            sections.append((h, []))
        elif line.strip():
            para.append(" ".join(line.split()))
        else:
            end_para()
    end_para()

    chunks: list[str] = []
    for heading, paragraphs in sections:
        if not paragraphs:
            continue
        label = " › ".join(x for x in (title.strip(), heading) if x)
        prefix = f"[{label}]\n" if label else ""
        room = max(200, size - len(prefix))
        cur = ""
        for p in paragraphs:
            for piece in _split_long(p, room) if len(p) > room else [p]:
                if cur and len(cur) + 1 + len(piece) > room:
                    chunks.append(prefix + cur)
                    cur = piece
                else:
                    cur = f"{cur}\n{piece}".strip()
        if cur:
            chunks.append(prefix + cur)
    return chunks


async def ingest(session: AsyncSession, document_id: uuid.UUID, raw_text: str) -> int:
    """Re-index satu dokumen. Return jumlah chunk. status → ready kalau berhasil."""
    doc = await session.get(KnowledgeDocument, document_id)
    if doc is None:
        raise ValueError(f"dokumen {document_id} tidak ada")

    # Bersihkan chunk lama (idempoten utk reindex).
    await session.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document_id)
    )

    pieces = chunk_sections(raw_text, doc.title or "")
    for piece in pieces:
        # No embedding model / no AI tokens left → text is still stored and retrieval
        # falls back to keyword matching (see rag.retrieve).
        embedding = await metered.embed(session, doc.tenant_id, piece)
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
