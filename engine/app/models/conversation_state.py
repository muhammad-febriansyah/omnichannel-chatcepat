from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPkMixin

if TYPE_CHECKING:
    from .conversation import Conversation


class ConversationState(UUIDPkMixin, TimestampMixin, Base):
    """State machine flow per percakapan (docs/prd/05). 1 state per conversation."""

    __tablename__ = "conversation_states"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        sa.ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    flow_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("flows.id", ondelete="SET NULL")
    )
    current_node_id: Mapped[str | None] = mapped_column(sa.Text)
    context: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
    expires_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))

    conversation: Mapped["Conversation"] = relationship(back_populates="state")
