from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from .base import Base, TimestampMixin, UUIDPkMixin, knowledge_source_type, knowledge_status

if TYPE_CHECKING:
    pass

EMBEDDING_DIM = 1536


class KnowledgeDocument(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_documents"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[str] = mapped_column(knowledge_source_type, nullable=False)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(
        knowledge_status, nullable=False, server_default="processing"
    )
    meta: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )

    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class KnowledgeChunk(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_chunks"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    token_count: Mapped[int | None] = mapped_column(sa.Integer)

    document: Mapped["KnowledgeDocument"] = relationship(back_populates="chunks")


class KnowledgeFaq(UUIDPkMixin, TimestampMixin, Base):
    """Question/answer pair written by the business (web); AI answers from it first."""

    __tablename__ = "knowledge_faqs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[str] = mapped_column(sa.Text, nullable=False)
    answer: Mapped[str] = mapped_column(sa.Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())


class AiUnanswered(UUIDPkMixin, Base):
    """A question the AI had no data for (counted per normalized text)."""

    __tablename__ = "ai_unanswered"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    question: Mapped[str] = mapped_column(sa.Text, nullable=False)
    question_norm: Mapped[str] = mapped_column(sa.Text, nullable=False)
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("conversations.id", ondelete="SET NULL")
    )
    ask_count: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="1")
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="open")
    faq_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("knowledge_faqs.id", ondelete="SET NULL")
    )
    last_asked_at = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()"))
    created_at = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()"))
