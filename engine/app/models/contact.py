from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin, opt_in_source, opt_in_status


class Contact(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "contacts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    phone: Mapped[str | None] = mapped_column(sa.Text)  # E.164, nullable utk IG/FB
    external_id: Mapped[str | None] = mapped_column(sa.Text)  # psid/ig id
    name: Mapped[str | None] = mapped_column(sa.Text)
    opt_in_status: Mapped[str] = mapped_column(
        opt_in_status, nullable=False, server_default="unknown"
    )
    opt_in_source: Mapped[str | None] = mapped_column(opt_in_source)
    opt_in_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(sa.Text), nullable=False, server_default=sa.text("'{}'::text[]")
    )
    attributes: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
    last_contacted_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
