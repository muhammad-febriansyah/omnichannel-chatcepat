from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin


class AuditLog(UUIDPkMixin, TimestampMixin, Base):
    """Jejak aksi sensitif: connect channel, kirim broadcast, ubah role, dll (docs/prd/03)."""

    __tablename__ = "audit_logs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(sa.Text, nullable=False)
    entity: Mapped[str] = mapped_column(sa.Text, nullable=False)
    entity_id: Mapped[str | None] = mapped_column(sa.Text)
    diff: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
