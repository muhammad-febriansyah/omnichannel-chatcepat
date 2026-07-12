from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin, UUIDPkMixin, channel_status, channel_type


class Channel(UUIDPkMixin, TimestampMixin, Base):
    __tablename__ = "channels"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(channel_type, nullable=False)
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(
        channel_status, nullable=False, server_default="pending"
    )
    # credentials terenkripsi at-rest (token, phone_number_id, waba_id, bot token, dst).
    credentials: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
    external_id: Mapped[str | None] = mapped_column(sa.Text)  # phone_number_id/page id/bot id
    meta: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
    )
    # Balas otomatis (flow + AI) per-channel. Default ON; wa_unofficial di-backfill
    # OFF (balasan bot dari nomor pribadi rawan banned) — dikontrol toggle di web.
    auto_reply_enabled: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("true")
    )
