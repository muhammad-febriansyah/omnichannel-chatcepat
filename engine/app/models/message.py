from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import (
    Base,
    TimestampMixin,
    UUIDPkMixin,
    message_direction,
    message_sender,
    message_status,
    message_type,
)

if TYPE_CHECKING:
    from .conversation import Conversation


class Message(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "messages"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    # channel_id ikut tersimpan utk unique (channel_id, provider_message_id). Lihat 02.
    channel_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False
    )
    direction: Mapped[str] = mapped_column(message_direction, nullable=False)
    sender: Mapped[str] = mapped_column(message_sender, nullable=False)
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    type: Mapped[str] = mapped_column(message_type, nullable=False, server_default="text")
    body: Mapped[str | None] = mapped_column(sa.Text)
    media: Mapped[dict | None] = mapped_column(JSONB)
    provider_message_id: Mapped[str | None] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(
        message_status, nullable=False, server_default="queued"
    )
    idempotency_key: Mapped[str | None] = mapped_column(sa.Text)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
