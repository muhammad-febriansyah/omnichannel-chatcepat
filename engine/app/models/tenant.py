from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin, tenant_plan, tenant_status


class Tenant(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    slug: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    plan: Mapped[str] = mapped_column(tenant_plan, nullable=False, server_default="pro")
    status: Mapped[str] = mapped_column(
        tenant_status, nullable=False, server_default="active"
    )
    # Tanggal berakhir langganan. NULL = tanpa batas (tak pernah di-downgrade).
    plan_expires_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    settings: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
