"""Per-channel source selection for auto replies (menu, AI, or hybrid)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0017_channel_reply_mode"
down_revision: Union[str, None] = "0016_social_automation_rules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    mode = postgresql.ENUM("menu", "ai", "hybrid", name="auto_reply_mode", create_type=False)
    mode.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "channels",
        sa.Column(
            "auto_reply_mode",
            mode,
            nullable=False,
            server_default="hybrid",
        ),
    )
    op.add_column("channels", sa.Column("default_flow_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "channels_default_flow_id_fkey",
        "channels",
        "flows",
        ["default_flow_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_channel_default_flow",
        "channels",
        ["tenant_id", "default_flow_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_channel_default_flow", table_name="channels")
    op.drop_constraint("channels_default_flow_id_fkey", "channels", type_="foreignkey")
    op.drop_column("channels", "default_flow_id")
    op.drop_column("channels", "auto_reply_mode")
    postgresql.ENUM(name="auto_reply_mode").drop(op.get_bind(), checkfirst=True)
