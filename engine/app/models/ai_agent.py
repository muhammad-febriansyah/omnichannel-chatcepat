from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin


class AiAgent(UUIDPkMixin, TimestampMixin, Base):
    """An AI agent: reply style + instructions + knowledge scope (migration 0022)."""

    __tablename__ = "ai_agents"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    role: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="cs")
    tone: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="ramah")
    emoji: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="sedikit")
    length: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="pendek")
    greeting: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="kak")
    language: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="auto")
    goal: Mapped[str | None] = mapped_column(sa.Text)
    instructions: Mapped[str | None] = mapped_column(sa.Text)
    examples: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    handoff_rules: Mapped[str | None] = mapped_column(sa.Text)
    fallback_message: Mapped[str | None] = mapped_column(sa.Text)
    # Structured business facts (hours, address, shipping…) injected into the prompt.
    business_info: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
    knowledge_all: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    use_catalog: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    use_promos: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    is_default: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.false())
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())


class AiAgentKnowledge(Base):
    """Knowledge documents an agent may use when knowledge_all is false."""

    __tablename__ = "ai_agent_knowledge"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("ai_agents.id", ondelete="CASCADE"), primary_key=True
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"), primary_key=True
    )


class Promo(UUIDPkMixin, TimestampMixin, Base):
    """Promotion the AI may mention while active (never invent discounts)."""

    __tablename__ = "promos"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text)
    code: Mapped[str | None] = mapped_column(sa.Text)
    starts_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
