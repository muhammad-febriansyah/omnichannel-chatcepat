"""Mailketing email notification delivery records."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_email_notifications"
down_revision: Union[str, None] = "0014_social_automation"
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
        "email_notifications",
        _id(),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE")),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("dedupe_key", sa.Text, nullable=False, unique=True),
        sa.Column("recipient", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("error_message", sa.Text),
        *_timestamps(),
        sa.CheckConstraint(
            "kind IN ('welcome', 'plan_expiry_3d', 'plan_expired')",
            name="ck_email_notification_kind",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'sending', 'sent', 'failed')",
            name="ck_email_notification_status",
        ),
    )
    op.create_index(
        "idx_email_notification_tenant_kind",
        "email_notifications",
        ["tenant_id", "kind", "created_at"],
    )
    op.create_index(
        "idx_email_notification_status",
        "email_notifications",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_email_notification_status", table_name="email_notifications")
    op.drop_index("idx_email_notification_tenant_kind", table_name="email_notifications")
    op.drop_table("email_notifications")
