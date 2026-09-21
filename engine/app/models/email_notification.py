from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin


class EmailNotification(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "email_notifications"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    kind: Mapped[str] = mapped_column(sa.Text, nullable=False)
    dedupe_key: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    recipient: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="pending")
    sent_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    error_message: Mapped[str | None] = mapped_column(sa.Text)
