from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin, user_role, user_status


class User(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # nullable: admin = platform (tenant_id NULL); client selalu punya tenant. Lihat docs/prd/03.
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    email: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(sa.Text, nullable=False)
    role: Mapped[str] = mapped_column(user_role, nullable=False)
    status: Mapped[str] = mapped_column(
        user_status, nullable=False, server_default="invited"
    )
    last_active_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))
    avatar_url: Mapped[str | None] = mapped_column(sa.Text)
