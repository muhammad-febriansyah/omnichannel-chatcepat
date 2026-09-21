from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin


class SocialAccount(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "social_accounts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    platform: Mapped[str] = mapped_column(sa.Text, nullable=False)
    username: Mapped[str | None] = mapped_column(sa.Text)
    profile_path: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="disconnected")
    last_connected_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    last_activity_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    last_error: Mapped[str | None] = mapped_column(sa.Text)


class SocialJob(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "social_jobs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    social_account_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(sa.Text, nullable=False)
    action: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="comment")
    target_url: Mapped[str] = mapped_column(sa.Text, nullable=False)
    content: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(sa.Text, nullable=False, server_default="pending")
    attempts: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("0"))
    max_attempts: Mapped[int] = mapped_column(sa.Integer, nullable=False, server_default=sa.text("3"))
    scheduled_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
    )
    started_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    failed_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    error_message: Mapped[str | None] = mapped_column(sa.Text)


class SocialActivityLog(UUIDPkMixin, Base):
    __tablename__ = "activity_logs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")
    )
    connection_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("channel_connections.id", ondelete="SET NULL")
    )
    social_account_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("social_accounts.id", ondelete="SET NULL")
    )
    social_job_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("social_jobs.id", ondelete="SET NULL")
    )
    type: Mapped[str] = mapped_column(sa.Text, nullable=False)
    description: Mapped[str] = mapped_column(sa.Text, nullable=False)
    event: Mapped[str | None] = mapped_column(sa.Text)
    message: Mapped[str | None] = mapped_column(sa.Text)
    metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()
    )
