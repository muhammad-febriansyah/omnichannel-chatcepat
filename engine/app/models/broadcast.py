from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import (
    Base,
    TimestampMixin,
    UUIDPkMixin,
    broadcast_recipient_status,
    broadcast_status,
)

if TYPE_CHECKING:
    from .contact import Contact


class Broadcast(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "broadcasts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    channel_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    template_id: Mapped[str | None] = mapped_column(sa.Text)  # official only
    # Snapshot isi pesan saat dibuat — jangan join ke template yg bisa berubah.
    body_snapshot: Mapped[str | None] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(
        broadcast_status, nullable=False, server_default="draft"
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    audience_filter: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
    stats: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )

    recipients: Mapped[list["BroadcastRecipient"]] = relationship(
        back_populates="broadcast", cascade="all, delete-orphan"
    )


class BroadcastRecipient(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "broadcast_recipients"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    broadcast_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        broadcast_recipient_status, nullable=False, server_default="pending"
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("messages.id", ondelete="SET NULL")
    )
    error: Mapped[str | None] = mapped_column(sa.Text)

    broadcast: Mapped["Broadcast"] = relationship(back_populates="recipients")
    contact: Mapped["Contact"] = relationship()
