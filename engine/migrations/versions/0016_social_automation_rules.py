"""Rules, incoming events, and guarded actions for social automation."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_social_automation_rules"
down_revision: Union[str, None] = "0015_email_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _id() -> sa.Column:
    return sa.Column(
        "id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
    ]


def upgrade() -> None:
    op.add_column("social_accounts", sa.Column("external_user_id", sa.Text))
    op.add_column("social_accounts", sa.Column("last_action_at", sa.TIMESTAMP(timezone=True)))
    op.add_column("social_accounts", sa.Column("last_success_at", sa.TIMESTAMP(timezone=True)))
    op.add_column("social_accounts", sa.Column("last_error_at", sa.TIMESTAMP(timezone=True)))
    op.add_column("social_accounts", sa.Column("last_warning_at", sa.TIMESTAMP(timezone=True)))
    op.add_column(
        "social_accounts",
        sa.Column("consecutive_errors", sa.Integer, nullable=False, server_default=sa.text("0")),
    )
    op.add_column("social_accounts", sa.Column("paused_until", sa.TIMESTAMP(timezone=True)))

    op.create_table(
        "social_account_settings",
        _id(),
        sa.Column(
            "social_account_id",
            sa.Uuid,
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("automation_enabled", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("comment_scanner_enabled", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("message_scanner_enabled", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("comment_reply_enabled", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("comment_private_reply_enabled", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("message_reply_enabled", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("reply_cooldown_seconds", sa.Integer, nullable=False, server_default=sa.text("30")),
        sa.Column("max_consecutive_errors", sa.Integer, nullable=False, server_default=sa.text("3")),
        *_timestamps(),
        sa.CheckConstraint("reply_cooldown_seconds >= 0", name="ck_social_settings_cooldown"),
        sa.CheckConstraint("max_consecutive_errors > 0", name="ck_social_settings_error_limit"),
    )

    op.create_table(
        "auto_reply_rules",
        _id(),
        sa.Column(
            "social_account_id",
            sa.Uuid,
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("platform", sa.Text, nullable=False),
        sa.Column("source_type", sa.Text, nullable=False),
        sa.Column("match_type", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("priority", sa.Integer, nullable=False, server_default=sa.text("0")),
        *_timestamps(),
        sa.CheckConstraint("platform IN ('facebook', 'instagram')", name="ck_auto_reply_rule_platform"),
        sa.CheckConstraint("source_type IN ('comment', 'message')", name="ck_auto_reply_rule_source"),
        sa.CheckConstraint(
            "match_type IN ('exact', 'contains', 'starts_with')", name="ck_auto_reply_rule_match"
        ),
    )
    op.create_index(
        "idx_auto_reply_rule_account_active",
        "auto_reply_rules",
        ["social_account_id", "is_active", "priority"],
    )

    op.create_table(
        "auto_reply_rule_keywords",
        _id(),
        sa.Column(
            "auto_reply_rule_id",
            sa.Uuid,
            sa.ForeignKey("auto_reply_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("keyword", sa.Text, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("auto_reply_rule_id", "keyword", name="uq_auto_reply_keyword"),
    )

    op.create_table(
        "auto_reply_rule_actions",
        _id(),
        sa.Column(
            "auto_reply_rule_id",
            sa.Uuid,
            sa.ForeignKey("auto_reply_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action_type", sa.Text, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.CheckConstraint(
            "action_type IN ('reply_comment', 'send_private_reply', 'reply_message')",
            name="ck_auto_reply_action_type",
        ),
    )
    op.create_index(
        "idx_auto_reply_action_rule_order",
        "auto_reply_rule_actions",
        ["auto_reply_rule_id", "sort_order"],
    )

    op.create_table(
        "auto_reply_action_responses",
        _id(),
        sa.Column(
            "auto_reply_rule_action_id",
            sa.Uuid,
            sa.ForeignKey("auto_reply_rule_actions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "social_account_ignore_keywords",
        _id(),
        sa.Column(
            "social_account_id",
            sa.Uuid,
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("keyword", sa.Text, nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("social_account_id", "keyword", name="uq_social_ignore_keyword"),
    )

    op.create_table(
        "social_incoming_events",
        _id(),
        sa.Column(
            "social_account_id",
            sa.Uuid,
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform", sa.Text, nullable=False),
        sa.Column("source_type", sa.Text, nullable=False),
        sa.Column("external_id", sa.Text, nullable=False),
        sa.Column("parent_external_id", sa.Text),
        sa.Column("author_external_id", sa.Text, nullable=False),
        sa.Column("author_name", sa.Text),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("target_url", sa.Text),
        sa.Column("received_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="new"),
        sa.Column("matched_rule_id", sa.Uuid, sa.ForeignKey("auto_reply_rules.id", ondelete="SET NULL")),
        sa.Column("is_from_self", sa.Boolean, nullable=False, server_default=sa.false()),
        *_timestamps(),
        sa.UniqueConstraint(
            "platform", "social_account_id", "external_id", name="uq_social_incoming_event_external"
        ),
        sa.CheckConstraint("source_type IN ('comment', 'message')", name="ck_social_event_source"),
        sa.CheckConstraint(
            "status IN ('new', 'matched', 'queued', 'processed', 'ignored', 'failed')",
            name="ck_social_event_status",
        ),
    )
    op.create_index(
        "idx_social_incoming_account_status",
        "social_incoming_events",
        ["social_account_id", "status", "received_at"],
    )

    op.create_table(
        "social_event_actions",
        _id(),
        sa.Column(
            "social_incoming_event_id",
            sa.Uuid,
            sa.ForeignKey("social_incoming_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action_type", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("external_result_id", sa.Text),
        sa.Column("executed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("error_message", sa.Text),
        *_timestamps(),
        sa.UniqueConstraint(
            "social_incoming_event_id", "action_type", name="uq_social_event_action_type"
        ),
        sa.CheckConstraint(
            "action_type IN ('reply_comment', 'send_private_reply', 'reply_message')",
            name="ck_social_event_action_type",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')",
            name="ck_social_event_action_status",
        ),
    )

    op.add_column("social_jobs", sa.Column("source_event_id", sa.Uuid))
    op.add_column("social_jobs", sa.Column("rule_id", sa.Uuid))
    op.create_foreign_key(
        "social_jobs_source_event_id_fkey",
        "social_jobs",
        "social_incoming_events",
        ["source_event_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "social_jobs_rule_id_fkey",
        "social_jobs",
        "auto_reply_rules",
        ["rule_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.drop_constraint("ck_social_job_action", "social_jobs", type_="check")
    op.create_check_constraint(
        "ck_social_job_action",
        "social_jobs",
        "action IN ('comment', 'post', 'reply_comment', 'send_private_reply', 'reply_message', 'scan_comments', 'scan_messages', 'read_comments', 'read_notifications')",
    )
    op.create_index("idx_social_job_source_event", "social_jobs", ["source_event_id", "action"])


def downgrade() -> None:
    op.drop_index("idx_social_job_source_event", table_name="social_jobs")
    op.drop_constraint("ck_social_job_action", "social_jobs", type_="check")
    op.create_check_constraint(
        "ck_social_job_action",
        "social_jobs",
        "action IN ('comment', 'post', 'reply_comment', 'read_comments', 'read_notifications')",
    )
    op.drop_constraint("social_jobs_rule_id_fkey", "social_jobs", type_="foreignkey")
    op.drop_constraint("social_jobs_source_event_id_fkey", "social_jobs", type_="foreignkey")
    op.drop_column("social_jobs", "rule_id")
    op.drop_column("social_jobs", "source_event_id")
    op.drop_table("social_event_actions")
    op.drop_index("idx_social_incoming_account_status", table_name="social_incoming_events")
    op.drop_table("social_incoming_events")
    op.drop_table("social_account_ignore_keywords")
    op.drop_table("auto_reply_action_responses")
    op.drop_index("idx_auto_reply_action_rule_order", table_name="auto_reply_rule_actions")
    op.drop_table("auto_reply_rule_actions")
    op.drop_table("auto_reply_rule_keywords")
    op.drop_index("idx_auto_reply_rule_account_active", table_name="auto_reply_rules")
    op.drop_table("auto_reply_rules")
    op.drop_table("social_account_settings")
    for column in (
        "paused_until",
        "consecutive_errors",
        "last_warning_at",
        "last_error_at",
        "last_success_at",
        "last_action_at",
        "external_user_id",
    ):
        op.drop_column("social_accounts", column)
