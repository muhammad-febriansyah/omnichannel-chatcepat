"""initial schema — 14 tabel domain + enum + index + pgvector (docs/prd/02)

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-16

Hand-written supaya index khusus (partial WHERE, GIN, ivfflat) persis PRD 02.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 1536

# nama enum -> nilai (sumber sama dgn app/models/base.py)
ENUMS: dict[str, tuple[str, ...]] = {
    "tenant_plan": ("pro", "business", "enterprise"),
    "tenant_status": ("active", "suspended"),
    "user_role": ("super_admin", "admin", "supervisor", "agent"),
    "user_status": ("active", "invited", "disabled"),
    "channel_type": ("wa_official", "wa_unofficial", "instagram", "facebook", "telegram"),
    "channel_status": ("connected", "disconnected", "pending", "banned"),
    "opt_in_status": ("opted_in", "opted_out", "unknown"),
    "opt_in_source": ("import", "form", "click_to_chat", "qr", "inbound"),
    "conversation_status": ("open", "pending", "resolved", "snoozed"),
    "conversation_handler": ("bot", "agent", "idle"),
    "message_direction": ("inbound", "outbound"),
    "message_sender": ("contact", "bot", "agent", "system"),
    "message_type": ("text", "image", "file", "template", "interactive"),
    "message_status": ("queued", "sent", "delivered", "read", "failed"),
    "flow_status": ("draft", "active"),
    "flow_trigger": ("keyword", "welcome", "fallback"),
    "knowledge_source_type": ("file", "url", "faq", "manual"),
    "knowledge_status": ("processing", "ready"),
    "broadcast_status": ("draft", "scheduled", "running", "done", "failed"),
    "broadcast_recipient_status": (
        "pending", "sent", "delivered", "failed", "skipped_optout",
    ),
}


def _enum(name: str) -> postgresql.ENUM:
    return postgresql.ENUM(*ENUMS[name], name=name, create_type=False)


def _id() -> sa.Column:
    return sa.Column(
        "id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    ]


def _tenant_fk() -> sa.Column:
    return sa.Column(
        "tenant_id",
        sa.Uuid,
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    for name, values in ENUMS.items():
        vals = ", ".join(f"'{v}'" for v in values)
        op.execute(f"CREATE TYPE {name} AS ENUM ({vals})")

    # --- tenants ---
    op.create_table(
        "tenants",
        _id(),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("slug", sa.Text, nullable=False, unique=True),
        sa.Column("plan", _enum("tenant_plan"), nullable=False, server_default="pro"),
        sa.Column("status", _enum("tenant_status"), nullable=False, server_default="active"),
        sa.Column("settings", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )

    # --- users ---
    op.create_table(
        "users",
        _id(),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("role", _enum("user_role"), nullable=False),
        sa.Column("status", _enum("user_status"), nullable=False, server_default="invited"),
        sa.Column("last_active_at", sa.TIMESTAMP(timezone=True)),
        *_timestamps(),
    )

    # --- channels ---
    op.create_table(
        "channels",
        _id(),
        _tenant_fk(),
        sa.Column("type", _enum("channel_type"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("status", _enum("channel_status"), nullable=False, server_default="pending"),
        sa.Column("credentials", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("external_id", sa.Text),
        sa.Column("meta", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.create_index("idx_channel_lookup", "channels", ["tenant_id", "type", "status"])

    # --- contacts ---
    op.create_table(
        "contacts",
        _id(),
        _tenant_fk(),
        sa.Column("phone", sa.Text),
        sa.Column("external_id", sa.Text),
        sa.Column("name", sa.Text),
        sa.Column("opt_in_status", _enum("opt_in_status"), nullable=False, server_default="unknown"),
        sa.Column("opt_in_source", _enum("opt_in_source")),
        sa.Column("opt_in_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("tags", postgresql.ARRAY(sa.Text), nullable=False, server_default=sa.text("'{}'::text[]")),
        sa.Column("attributes", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_contacted_at", sa.TIMESTAMP(timezone=True)),
        *_timestamps(),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_contact_phone ON contacts (tenant_id, phone) WHERE phone IS NOT NULL"
    )
    op.create_index("idx_contact_optin", "contacts", ["tenant_id", "opt_in_status"])
    op.execute("CREATE INDEX idx_contact_tags ON contacts USING GIN (tags)")
    op.execute("CREATE INDEX idx_contact_attrs ON contacts USING GIN (attributes)")

    # --- flows ---
    op.create_table(
        "flows",
        _id(),
        _tenant_fk(),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("status", _enum("flow_status"), nullable=False, server_default="draft"),
        sa.Column("trigger", _enum("flow_trigger"), nullable=False),
        sa.Column("definition", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("version", sa.Integer, nullable=False, server_default=sa.text("1")),
        *_timestamps(),
    )

    # --- conversations ---
    op.create_table(
        "conversations",
        _id(),
        _tenant_fk(),
        sa.Column("channel_id", sa.Uuid, sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", sa.Uuid, sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", _enum("conversation_status"), nullable=False, server_default="open"),
        sa.Column("handler", _enum("conversation_handler"), nullable=False, server_default="bot"),
        sa.Column("assigned_agent_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("last_message_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("last_message_preview", sa.Text),
        sa.Column("unread_count", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("service_window_expires_at", sa.TIMESTAMP(timezone=True)),
        *_timestamps(),
    )
    op.execute(
        "CREATE INDEX idx_conv_inbox ON conversations (tenant_id, status, last_message_at DESC)"
    )
    op.execute(
        "CREATE INDEX idx_conv_assigned ON conversations (tenant_id, assigned_agent_id, last_message_at DESC)"
    )
    op.create_index("idx_conv_channel", "conversations", ["tenant_id", "channel_id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_conv_open ON conversations (channel_id, contact_id) WHERE status != 'resolved'"
    )

    # --- messages ---
    op.create_table(
        "messages",
        _id(),
        _tenant_fk(),
        sa.Column("conversation_id", sa.Uuid, sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel_id", sa.Uuid, sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("direction", _enum("message_direction"), nullable=False),
        sa.Column("sender", _enum("message_sender"), nullable=False),
        sa.Column("agent_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("type", _enum("message_type"), nullable=False, server_default="text"),
        sa.Column("body", sa.Text),
        sa.Column("media", postgresql.JSONB),
        sa.Column("provider_message_id", sa.Text),
        sa.Column("status", _enum("message_status"), nullable=False, server_default="queued"),
        sa.Column("idempotency_key", sa.Text),
        *_timestamps(),
    )
    op.execute(
        "CREATE INDEX idx_msg_thread ON messages (conversation_id, created_at DESC)"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_msg_provider ON messages (channel_id, provider_message_id)"
    )
    op.execute(
        "CREATE INDEX idx_msg_status ON messages (tenant_id, status) WHERE status IN ('queued','failed')"
    )

    # --- conversation_states ---
    op.create_table(
        "conversation_states",
        _id(),
        _tenant_fk(),
        sa.Column("conversation_id", sa.Uuid, sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("flow_id", sa.Uuid, sa.ForeignKey("flows.id", ondelete="SET NULL")),
        sa.Column("current_node_id", sa.Text),
        sa.Column("context", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True)),
        *_timestamps(),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_state_conv ON conversation_states (conversation_id)"
    )

    # --- knowledge_documents ---
    op.create_table(
        "knowledge_documents",
        _id(),
        _tenant_fk(),
        sa.Column("source_type", _enum("knowledge_source_type"), nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("status", _enum("knowledge_status"), nullable=False, server_default="processing"),
        sa.Column("meta", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )

    # --- knowledge_chunks ---
    op.create_table(
        "knowledge_chunks",
        _id(),
        _tenant_fk(),
        sa.Column("document_id", sa.Uuid, sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM)),
        sa.Column("token_count", sa.Integer),
        *_timestamps(),
    )
    op.create_index("idx_kchunk_tenant", "knowledge_chunks", ["tenant_id", "document_id"])
    op.execute(
        "CREATE INDEX idx_kchunk_vec ON knowledge_chunks "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # --- broadcasts ---
    op.create_table(
        "broadcasts",
        _id(),
        _tenant_fk(),
        sa.Column("channel_id", sa.Uuid, sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("template_id", sa.Text),
        sa.Column("body_snapshot", sa.Text),
        sa.Column("status", _enum("broadcast_status"), nullable=False, server_default="draft"),
        sa.Column("scheduled_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("audience_filter", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("stats", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.execute(
        "CREATE INDEX idx_bcast_sched ON broadcasts (tenant_id, status, scheduled_at)"
    )

    # --- broadcast_recipients ---
    op.create_table(
        "broadcast_recipients",
        _id(),
        _tenant_fk(),
        sa.Column("broadcast_id", sa.Uuid, sa.ForeignKey("broadcasts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", sa.Uuid, sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", _enum("broadcast_recipient_status"), nullable=False, server_default="pending"),
        sa.Column("message_id", sa.Uuid, sa.ForeignKey("messages.id", ondelete="SET NULL")),
        sa.Column("error", sa.Text),
        *_timestamps(),
    )
    op.create_index("idx_bcast_recip", "broadcast_recipients", ["broadcast_id", "status"])

    # --- tags ---
    op.create_table(
        "tags",
        _id(),
        _tenant_fk(),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("color", sa.Text),
        *_timestamps(),
    )

    # --- audit_logs ---
    op.create_table(
        "audit_logs",
        _id(),
        _tenant_fk(),
        sa.Column("actor_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.Text, nullable=False),
        sa.Column("entity", sa.Text, nullable=False),
        sa.Column("entity_id", sa.Text),
        sa.Column("diff", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        *_timestamps(),
    )
    op.execute("CREATE INDEX idx_audit ON audit_logs (tenant_id, created_at DESC)")


def downgrade() -> None:
    for table in [
        "audit_logs", "tags", "broadcast_recipients", "broadcasts",
        "knowledge_chunks", "knowledge_documents", "conversation_states",
        "messages", "conversations", "flows", "contacts", "channels",
        "users", "tenants",
    ]:
        op.drop_table(table)

    for name in ENUMS:
        op.execute(f"DROP TYPE IF EXISTS {name}")

    op.execute("DROP EXTENSION IF EXISTS vector")
