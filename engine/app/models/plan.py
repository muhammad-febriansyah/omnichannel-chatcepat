from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin, tenant_plan


class Plan(UUIDPkMixin, TimestampMixin, Base):
    """Paket pricing global (dikelola super-admin). Bukan tenant-scoped."""

    __tablename__ = "plans"

    tier: Mapped[str] = mapped_column(tenant_plan, nullable=False, server_default="pro")
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    slug: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    price_idr: Mapped[int] = mapped_column(sa.BigInteger, nullable=False, server_default="0")
    period: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="month")
    quota: Mapped[int | None] = mapped_column(sa.Integer)
    description: Mapped[str | None] = mapped_column(sa.Text)
    features: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=sa.text("'[]'::jsonb"))
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.text("true"))
    highlight: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.text("false"))
    sort_order: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="0")
