from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin, template_kind, template_status


class Template(UUIDPkMixin, TimestampMixin, Base):
    """Template WA HSM (perlu approval) + balasan cepat. CRUD oleh web (docs/prd/08)."""

    __tablename__ = "templates"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    kind: Mapped[str] = mapped_column(
        template_kind, nullable=False, server_default="quick_reply"
    )
    category: Mapped[str | None] = mapped_column(sa.Text)
    language: Mapped[str | None] = mapped_column(sa.Text)
    body: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(
        template_status, nullable=False, server_default="draft"
    )
