"""Omnichannel workspace: connections, comments, automations, approvals.

The existing product uses ``tenants`` as its workspace boundary. New tables keep
the public/API-facing name ``workspace_id`` while referencing ``tenants.id`` so
the omnichannel surface can coexist with the existing dashboard and tenant scope.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_omnichannel"
down_revision: Union[str, None] = "0011_wa_official_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _id() -> sa.Column:
    return sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _workspace_fk() -> sa.Column:
    return sa.Column(
        "workspace_id",
        sa.Uuid,
        sa.ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def _json() -> sa.Column:
    return sa.Column("metadata", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb"))


def upgrade() -> None:
    op.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS username TEXT")
    op.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT")

    op.create_table(
        "channel_connections",
        _id(),
        _workspace_fk(),
        sa.Column("channel_type", sa.Text, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="disconnected"),
        sa.Column("credentials_encrypted", sa.LargeBinary),
        sa.Column("session_data_encrypted", sa.LargeBinary),
        _json(),
        sa.Column("last_health_check", sa.TIMESTAMP(timezone=True)),
        sa.Column("last_successful_request", sa.TIMESTAMP(timezone=True)),
        sa.Column("last_error", sa.Text),
        sa.Column("automation_paused", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("consecutive_failures", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("circuit_open_until", sa.TIMESTAMP(timezone=True)),
        *_timestamps(),
        sa.CheckConstraint("channel_type IN ('instagram', 'whatsapp', 'facebook')", name="ck_connection_channel_type"),
        sa.CheckConstraint(
            "status IN ('connected', 'disconnected', 'healthy', 'needs_attention', 'challenge_required', 'session_expired', 'rate_limited', 'disabled', 'error')",
            name="ck_connection_status",
        ),
    )
    op.create_index("idx_connection_workspace_status", "channel_connections", ["workspace_id", "status", "created_at"])

    op.create_table(
        "contact_identities",
        _id(),
        _workspace_fk(),
        sa.Column("contact_id", sa.Uuid, sa.ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel_type", sa.Text, nullable=False),
        sa.Column("channel_connection_id", sa.Uuid, sa.ForeignKey("channel_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_user_id", sa.Text, nullable=False),
        sa.Column("username", sa.Text),
        _json(),
        *_timestamps(),
    )
    op.create_unique_constraint("uq_contact_identity_external", "contact_identities", ["channel_type", "channel_connection_id", "external_user_id"])
    op.create_index("idx_contact_identity_contact", "contact_identities", ["workspace_id", "contact_id"])

    op.create_table(
        "channel_posts",
        _id(),
        _workspace_fk(),
        sa.Column("channel_connection_id", sa.Uuid, sa.ForeignKey("channel_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_post_id", sa.Text, nullable=False),
        sa.Column("type", sa.Text, nullable=False, server_default="post"),
        sa.Column("caption", sa.Text),
        sa.Column("media_url", sa.Text),
        sa.Column("permalink", sa.Text),
        sa.Column("posted_at", sa.TIMESTAMP(timezone=True)),
        _json(),
        *_timestamps(),
    )
    op.create_unique_constraint("uq_channel_post_external", "channel_posts", ["channel_connection_id", "external_post_id"])
    op.create_index("idx_channel_post_workspace", "channel_posts", ["workspace_id", "created_at"])

    op.create_table(
        "comments",
        _id(),
        _workspace_fk(),
        sa.Column("channel_connection_id", sa.Uuid, sa.ForeignKey("channel_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_comment_id", sa.Text, nullable=False),
        sa.Column("external_post_id", sa.Text, nullable=False),
        sa.Column("contact_id", sa.Uuid, sa.ForeignKey("contacts.id", ondelete="SET NULL")),
        sa.Column("username", sa.Text, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="received"),
        sa.Column("commented_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        _json(),
        *_timestamps(),
    )
    op.create_unique_constraint("uq_comment_external", "comments", ["channel_connection_id", "external_comment_id"])
    op.create_index("idx_comment_workspace_created", "comments", ["workspace_id", "created_at"])
    op.create_index("idx_comment_connection_post", "comments", ["channel_connection_id", "external_post_id", "created_at"])
    op.create_index("idx_comment_contact", "comments", ["contact_id", "created_at"])

    op.create_table(
        "automation_rules",
        _id(),
        _workspace_fk(),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("channel_type", sa.Text, nullable=False),
        sa.Column("event_type", sa.Text, nullable=False, server_default="comment.created"),
        sa.Column("status", sa.Text, nullable=False, server_default="draft"),
        *_timestamps(),
    )
    op.create_index("idx_automation_rule_workspace", "automation_rules", ["workspace_id", "status", "created_at"])

    op.create_table(
        "automation_conditions",
        _id(),
        sa.Column("automation_rule_id", sa.Uuid, sa.ForeignKey("automation_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("operator", sa.Text, nullable=False),
        sa.Column("value", sa.Text, nullable=False),
        _json(),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
    )
    op.create_index("idx_automation_condition_rule", "automation_conditions", ["automation_rule_id", "sort_order"])

    op.create_table(
        "automation_actions",
        _id(),
        sa.Column("automation_rule_id", sa.Uuid, sa.ForeignKey("automation_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.Text, nullable=False),
        _json(),
        sa.Column("execution_mode", sa.Text, nullable=False, server_default="manual"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
    )
    op.create_index("idx_automation_action_rule", "automation_actions", ["automation_rule_id", "sort_order"])

    op.create_table(
        "automation_runs",
        _id(),
        _workspace_fk(),
        sa.Column("connection_id", sa.Uuid, sa.ForeignKey("channel_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("automation_rule_id", sa.Uuid, sa.ForeignKey("automation_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("comment_id", sa.Uuid, sa.ForeignKey("comments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="started"),
        sa.Column("error_message", sa.Text),
        *_timestamps(),
    )
    op.create_unique_constraint("uq_automation_run_comment_rule", "automation_runs", ["automation_rule_id", "comment_id"])
    op.create_index("idx_automation_run_workspace", "automation_runs", ["workspace_id", "created_at"])

    op.create_table(
        "channel_action_runs",
        _id(),
        _workspace_fk(),
        sa.Column("connection_id", sa.Uuid, sa.ForeignKey("channel_connections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("automation_run_id", sa.Uuid, sa.ForeignKey("automation_runs.id", ondelete="SET NULL")),
        sa.Column("action_type", sa.Text, nullable=False),
        sa.Column("idempotency_key", sa.Text, nullable=False, unique=True),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("attempt", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("external_id", sa.Text),
        sa.Column("error_message", sa.Text),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True)),
        *_timestamps(),
    )
    op.create_index("idx_action_run_workspace_status", "channel_action_runs", ["workspace_id", "status", "created_at"])

    op.create_table(
        "pending_actions",
        _id(),
        _workspace_fk(),
        sa.Column("channel_action_run_id", sa.Uuid, sa.ForeignKey("channel_action_runs.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("action_type", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("payload", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("reviewed_by", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("reviewed_at", sa.TIMESTAMP(timezone=True)),
        *_timestamps(),
    )
    op.create_index("idx_pending_action_workspace_status", "pending_actions", ["workspace_id", "status", "created_at"])

    op.create_table(
        "activity_logs",
        _id(),
        _workspace_fk(),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("connection_id", sa.Uuid, sa.ForeignKey("channel_connections.id", ondelete="SET NULL")),
        sa.Column("type", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        _json(),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_activity_workspace_created", "activity_logs", ["workspace_id", "created_at"])


def downgrade() -> None:
    for table in (
        "activity_logs",
        "pending_actions",
        "channel_action_runs",
        "automation_runs",
        "automation_actions",
        "automation_conditions",
        "automation_rules",
        "comments",
        "channel_posts",
        "contact_identities",
        "channel_connections",
    ):
        op.drop_table(table)
    op.execute("ALTER TABLE contacts DROP COLUMN IF EXISTS avatar_url")
    op.execute("ALTER TABLE contacts DROP COLUMN IF EXISTS username")
