"""Foundation tables for browser-based social automation jobs.

This migration is additive. The existing ``activity_logs`` table is shared by
the omnichannel console, so social-specific columns are added without removing
the legacy workspace/connection fields.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_social_automation"
down_revision: Union[str, None] = "0013_password_reset_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _id() -> sa.Column:
    return sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def upgrade() -> None:
    op.create_table(
        "social_accounts",
        _id(),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("platform", sa.Text, nullable=False),
        sa.Column("username", sa.Text),
        sa.Column("profile_path", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="disconnected"),
        sa.Column("last_connected_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("last_activity_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("last_error", sa.Text),
        *_timestamps(),
        sa.CheckConstraint("platform IN ('facebook', 'instagram')", name="ck_social_account_platform"),
        sa.CheckConstraint(
            "status IN ('disconnected', 'connecting', 'connected', 'action_required', 'paused', 'disabled')",
            name="ck_social_account_status",
        ),
    )
    op.create_index("idx_social_account_tenant_status", "social_accounts", ["tenant_id", "status", "created_at"])

    op.create_table(
        "social_jobs",
        _id(),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("social_account_id", sa.Uuid, sa.ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.Text, nullable=False),
        sa.Column("action", sa.Text, nullable=False, server_default="comment"),
        sa.Column("target_url", sa.Text, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer, nullable=False, server_default=sa.text("0")),
        sa.Column("max_attempts", sa.Integer, nullable=False, server_default=sa.text("3")),
        sa.Column("scheduled_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("failed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("error_message", sa.Text),
        *_timestamps(),
        sa.CheckConstraint("platform IN ('facebook', 'instagram')", name="ck_social_job_platform"),
        sa.CheckConstraint(
            "action IN ('comment', 'post', 'reply_comment', 'read_comments', 'read_notifications')",
            name="ck_social_job_action",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')",
            name="ck_social_job_status",
        ),
        sa.CheckConstraint("attempts >= 0 AND max_attempts > 0", name="ck_social_job_attempts"),
    )
    op.create_index("idx_social_job_tenant_status", "social_jobs", ["tenant_id", "status", "scheduled_at"])
    op.create_index("idx_social_job_account_status", "social_jobs", ["social_account_id", "status", "created_at"])

    op.add_column("activity_logs", sa.Column("social_account_id", sa.Uuid))
    op.add_column("activity_logs", sa.Column("social_job_id", sa.Uuid))
    op.add_column("activity_logs", sa.Column("event", sa.Text))
    op.add_column("activity_logs", sa.Column("message", sa.Text))
    op.create_foreign_key(
        "activity_logs_social_account_id_fkey",
        "activity_logs",
        "social_accounts",
        ["social_account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "activity_logs_social_job_id_fkey",
        "activity_logs",
        "social_jobs",
        ["social_job_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("idx_activity_social_account_created", "activity_logs", ["social_account_id", "created_at"])
    op.create_index("idx_activity_social_job_created", "activity_logs", ["social_job_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_activity_social_job_created", table_name="activity_logs")
    op.drop_index("idx_activity_social_account_created", table_name="activity_logs")
    op.drop_constraint("activity_logs_social_job_id_fkey", "activity_logs", type_="foreignkey")
    op.drop_constraint("activity_logs_social_account_id_fkey", "activity_logs", type_="foreignkey")
    op.drop_column("activity_logs", "message")
    op.drop_column("activity_logs", "event")
    op.drop_column("activity_logs", "social_job_id")
    op.drop_column("activity_logs", "social_account_id")
    op.drop_index("idx_social_job_account_status", table_name="social_jobs")
    op.drop_index("idx_social_job_tenant_status", table_name="social_jobs")
    op.drop_table("social_jobs")
    op.drop_index("idx_social_account_tenant_status", table_name="social_accounts")
    op.drop_table("social_accounts")
