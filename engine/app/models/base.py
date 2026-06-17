"""Base, mixin, dan enum PostgreSQL untuk semua model domain.

Skema kanonik dipegang migration Alembic (docs/prd/02). Enum di sini pakai
`create_type=False` — tipe ENUM dibuat di migration, model hanya mereferensikan.
"""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPkMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid,
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
    )


def pg_enum(*values: str, name: str) -> ENUM:
    """ENUM PG yang dibuat di migration (create_type=False)."""
    return ENUM(*values, name=name, create_type=False)


# --- ENUM domain (lihat docs/prd/02, 03, 05) ---
tenant_plan = pg_enum("pro", "business", "enterprise", name="tenant_plan")
tenant_status = pg_enum("active", "suspended", name="tenant_status")
user_role = pg_enum("super_admin", "admin", "supervisor", "agent", name="user_role")
user_status = pg_enum("active", "invited", "disabled", name="user_status")
channel_type = pg_enum(
    "wa_official", "wa_unofficial", "instagram", "facebook", "telegram", name="channel_type"
)
channel_status = pg_enum(
    "connected", "disconnected", "pending", "banned", name="channel_status"
)
opt_in_status = pg_enum("opted_in", "opted_out", "unknown", name="opt_in_status")
opt_in_source = pg_enum(
    "import", "form", "click_to_chat", "qr", "inbound", name="opt_in_source"
)
conversation_status = pg_enum(
    "open", "pending", "resolved", "snoozed", name="conversation_status"
)
conversation_handler = pg_enum("bot", "agent", "idle", name="conversation_handler")
message_direction = pg_enum("inbound", "outbound", name="message_direction")
message_sender = pg_enum("contact", "bot", "agent", "system", name="message_sender")
message_type = pg_enum(
    "text", "image", "file", "template", "interactive", name="message_type"
)
message_status = pg_enum(
    "queued", "sent", "delivered", "read", "failed", name="message_status"
)
flow_status = pg_enum("draft", "active", name="flow_status")
flow_trigger = pg_enum("keyword", "welcome", "fallback", name="flow_trigger")
knowledge_source_type = pg_enum("file", "url", "faq", "manual", name="knowledge_source_type")
knowledge_status = pg_enum("processing", "ready", name="knowledge_status")
broadcast_status = pg_enum(
    "draft", "scheduled", "running", "done", "failed", name="broadcast_status"
)
broadcast_recipient_status = pg_enum(
    "pending", "sent", "delivered", "failed", "skipped_optout",
    name="broadcast_recipient_status",
)
template_kind = pg_enum("hsm", "quick_reply", name="template_kind")
template_status = pg_enum("draft", "approved", "rejected", name="template_status")

# Nama semua ENUM — dipakai migration untuk create/drop type berurutan.
ENUM_NAMES = [
    "tenant_plan", "tenant_status", "user_role", "user_status", "channel_type",
    "channel_status", "opt_in_status", "opt_in_source", "conversation_status",
    "conversation_handler", "message_direction", "message_sender", "message_type",
    "message_status", "flow_status", "flow_trigger", "knowledge_source_type",
    "knowledge_status", "broadcast_status", "broadcast_recipient_status",
    "template_kind", "template_status",
]
