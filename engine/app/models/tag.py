from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin


class Tag(UUIDPkMixin, TimestampMixin, Base):
    """Master tag + warna. Kontak pakai array contacts.tags."""

    __tablename__ = "tags"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    color: Mapped[str | None] = mapped_column(sa.Text)
