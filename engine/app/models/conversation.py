from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import (
    Base,
    TimestampMixin,
    UUIDPkMixin,
    conversation_handler,
    conversation_status,
)

if TYPE_CHECKING:
    from .channel import Channel
    from .contact import Contact
    from .conversation_state import ConversationState
    from .message import Message
    from .user import User


class Conversation(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "conversations"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        conversation_status, nullable=False, server_default="open"
    )
    handler: Mapped[str] = mapped_column(
        conversation_handler, nullable=False, server_default="bot"
    )
    assigned_agent_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    last_message_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    last_message_preview: Mapped[str | None] = mapped_column(sa.Text)
    unread_count: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, server_default=sa.text("0")
    )
    # WA official: now()+24h tiap pesan masuk. Cek sebelum kirim free-form.
    service_window_expires_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True)
    )

    # Relationships — eager-load di repository (joinedload many-to-one, selectinload koleksi).
    contact: Mapped["Contact"] = relationship()
    channel: Mapped["Channel"] = relationship()
    assigned_agent: Mapped["User | None"] = relationship()
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    state: Mapped["ConversationState | None"] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", uselist=False
    )
