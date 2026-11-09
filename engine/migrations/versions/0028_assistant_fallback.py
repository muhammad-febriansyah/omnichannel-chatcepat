"""Assistant business info + per-channel "no flow matched" behaviour.

- ai_agents.business_info: structured facts the assistant may quote (hours, address,
  shipping, payment, returns, assistant/business name), injected into its prompt.
- channels.fallback_action: what happens when no flow matches a message —
  'ai' (answer with the channel's assistant), 'message' (fixed text), 'silent' (agent
  replies manually). Default 'message' keeps today's behaviour.
- channels.fallback_message: the fixed text for 'message' (NULL = built-in default).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0028_assistant_fallback"
down_revision: Union[str, None] = "0027_dashboard_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_agents",
        sa.Column("business_info", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "channels",
        sa.Column("fallback_action", sa.Text, nullable=False, server_default="message"),
    )
    op.add_column("channels", sa.Column("fallback_message", sa.Text))
    op.create_check_constraint(
        "ck_channels_fallback_action", "channels", "fallback_action IN ('ai', 'message', 'silent')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_channels_fallback_action", "channels", type_="check")
    op.drop_column("channels", "fallback_message")
    op.drop_column("channels", "fallback_action")
    op.drop_column("ai_agents", "business_info")
