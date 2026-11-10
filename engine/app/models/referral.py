"""Referral program tables (written by web; mirrored here so the metadata matches migration 0030)."""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin


class ReferralSettings(Base):
    """Single global row (id = 1), managed by the platform admin."""

    __tablename__ = "referral_settings"

    id: Mapped[int] = mapped_column(sa.SmallInteger, primary_key=True, server_default="1")
    is_enabled: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    commission_percent: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False, server_default="20")
    hold_days: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default="14")
    min_payout_idr: Mapped[int] = mapped_column(sa.BigInteger, nullable=False, server_default="100000")
    updated_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
    )


class ReferralAccount(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "referral_accounts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    code: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())
    bank_name: Mapped[str | None] = mapped_column(sa.Text)
    account_number: Mapped[str | None] = mapped_column(sa.Text)
    account_name: Mapped[str | None] = mapped_column(sa.Text)


class Referral(UUIDPkMixin, Base):
    """tenant_id = referrer. One row per referred tenant, set at signup."""

    __tablename__ = "referrals"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    referred_tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    code: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="pending")
    converted_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
    )


class ReferralPayout(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "referral_payouts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    amount_idr: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    bank_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    account_number: Mapped[str] = mapped_column(sa.Text, nullable=False)
    account_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="requested")
    note: Mapped[str | None] = mapped_column(sa.Text)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    processed_by: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    processed_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))


class ReferralCommission(UUIDPkMixin, TimestampMixin, Base):
    """tenant_id = referrer who earns it. Amounts are snapshots of the paid order."""

    __tablename__ = "referral_commissions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    referral_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False
    )
    referred_tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="SET NULL")
    )
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("orders.id", ondelete="SET NULL"), unique=True
    )
    referred_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    plan_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    order_amount_idr: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    commission_percent: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
    commission_idr: Mapped[int] = mapped_column(sa.BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="earned")
    available_at: Mapped[datetime] = mapped_column(sa.TIMESTAMP(timezone=True), nullable=False)
    payout_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("referral_payouts.id", ondelete="SET NULL")
    )
    void_reason: Mapped[str | None] = mapped_column(sa.Text)
