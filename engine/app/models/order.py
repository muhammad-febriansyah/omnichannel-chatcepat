from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin, order_status, tenant_plan


class Order(UUIDPkMixin, TimestampMixin, Base):
    """Order pembelian paket via Duitku. Tenant-scoped. Nilai paket di-snapshot."""

    __tablename__ = "orders"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("plans.id", ondelete="SET NULL")
    )
    plan_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    tier: Mapped[str] = mapped_column(tenant_plan, nullable=False)
    amount_idr: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    merchant_order_id: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    status: Mapped[str] = mapped_column(order_status, nullable=False, server_default="pending")
    duitku_reference: Mapped[str | None] = mapped_column(sa.Text)
    payment_url: Mapped[str | None] = mapped_column(sa.Text)
    payment_method: Mapped[str | None] = mapped_column(sa.Text)
    customer_name: Mapped[str | None] = mapped_column(sa.Text)
    customer_email: Mapped[str | None] = mapped_column(sa.Text)
    paid_at: Mapped[sa.DateTime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
