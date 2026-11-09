"""Knowledge FAQ lookups + "pertanyaan belum terjawab" log (tenant-scoped)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import case, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.rag import keywords
from ..models import AiUnanswered, KnowledgeFaq

# Small FAQ lists go to the AI whole; bigger ones are filtered by the question.
FAQ_ALL_BELOW = 15
FAQ_LIMIT = 6
_FAQ_SCAN = 500
QUESTION_MAX = 300


def normalize_question(text: str) -> str:
    """Same question, different spelling/punctuation → one row."""
    t = re.sub(r"[^\w\s]", " ", (text or "").lower(), flags=re.UNICODE)
    return " ".join(t.split())[:QUESTION_MAX]


def rank_faqs(faqs: list[KnowledgeFaq], query: str, limit: int = FAQ_LIMIT) -> list[KnowledgeFaq]:
    """FAQs sharing the most keywords with the question (question text weighs double)."""
    if len(faqs) <= FAQ_ALL_BELOW:
        return faqs
    words = keywords(query, limit=10)
    if not words:
        return []
    scored = []
    for f in faqs:
        q, a = (f.question or "").lower(), (f.answer or "").lower()
        score = sum(2 for w in words if w in q) + sum(1 for w in words if w in a)
        if score:
            scored.append((score, f))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [f for _, f in scored[:limit]]


async def relevant_faqs(session: AsyncSession, tenant_id: uuid.UUID, query: str) -> list[KnowledgeFaq]:
    if session is None:
        return []
    rows = await session.scalars(
        select(KnowledgeFaq)
        .where(KnowledgeFaq.tenant_id == tenant_id, KnowledgeFaq.is_active.is_(True))
        .order_by(KnowledgeFaq.updated_at.desc())
        .limit(_FAQ_SCAN)
    )
    return rank_faqs(list(rows), query)


async def record_unanswered(
    session: AsyncSession, tenant_id: uuid.UUID, conversation_id: uuid.UUID | None, question: str
) -> None:
    """Count a question the AI had no data for. Ignored ones stay ignored."""
    if session is None:
        return
    text = " ".join((question or "").split())[:QUESTION_MAX]
    norm = normalize_question(text)
    if len(norm) < 3:
        return
    now = datetime.now(timezone.utc)
    stmt = insert(AiUnanswered).values(
        tenant_id=tenant_id,
        question=text,
        question_norm=norm,
        conversation_id=conversation_id,
        last_asked_at=now,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[AiUnanswered.tenant_id, AiUnanswered.question_norm],
        set_={
            "ask_count": AiUnanswered.ask_count + 1,
            "last_asked_at": now,
            "conversation_id": conversation_id,
            # Answered before but the AI still had nothing (e.g. FAQ turned off) → reopen.
            "status": case((AiUnanswered.status == "ignored", "ignored"), else_="open"),
        },
    )
    await session.execute(stmt)
