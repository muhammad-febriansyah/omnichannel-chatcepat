"""Comment-triggered flows: flows.trigger gains 'comment'.

A flow with this trigger starts when someone comments on a connected Facebook
Page / Instagram post (Meta webhook feed/comments). It replies publicly under
the comment and/or sends one private DM to the commenter.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0023_flow_comment_trigger"
down_revision: Union[str, None] = "0022_ai_agents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE can't run inside a transaction block on older PG.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE flow_trigger ADD VALUE IF NOT EXISTS 'comment'")


def downgrade() -> None:
    # Postgres can't drop an enum value; 'comment' stays on flow_trigger.
    pass
