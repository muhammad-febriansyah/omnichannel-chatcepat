"""Explicit social post targets and per-author comment action deduplication."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0018_social_comment_targets"
down_revision = "0017_channel_reply_mode"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("social_account_settings", sa.Column(
        "comment_post_urls", postgresql.ARRAY(sa.Text()), nullable=False,
        server_default=sa.text("'{}'::text[]"),
    ))
    op.add_column("social_event_actions", sa.Column("dedupe_key", sa.Text(), nullable=True))
    op.create_index("uq_social_action_author_post", "social_event_actions", ["dedupe_key"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_social_action_author_post", table_name="social_event_actions")
    op.drop_column("social_event_actions", "dedupe_key")
    op.drop_column("social_account_settings", "comment_post_urls")
