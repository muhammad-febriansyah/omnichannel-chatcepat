"""Interactive broadcasts: template params, button clicks, and button-triggered flows.

- flows.trigger gains 'button': a flow starts when a contact taps a button whose
  label matches (quick reply on a broadcast template or an interactive reply).
- broadcasts snapshot the template language + parameters (header media, body
  variables) so later template/contact edits don't change what was sent.
- broadcast_recipients record which button each recipient tapped, for reports and
  follow-up broadcasts.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0021_broadcast_buttons"
down_revision: Union[str, None] = "0020_drop_apico"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE can't run inside a transaction block on older PG.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE flow_trigger ADD VALUE IF NOT EXISTS 'button'")

    op.add_column("broadcasts", sa.Column("template_lang", sa.Text))
    op.add_column(
        "broadcasts",
        sa.Column(
            "template_params",
            postgresql.JSONB,
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.add_column("broadcast_recipients", sa.Column("clicked_button", sa.Text))
    op.add_column("broadcast_recipients", sa.Column("clicked_at", sa.TIMESTAMP(timezone=True)))
    op.create_index(
        "idx_bcast_recip_click",
        "broadcast_recipients",
        ["tenant_id", "broadcast_id", "clicked_button"],
    )
    # Click lookup by (broadcast, contact) when a button payload comes back.
    op.create_index(
        "idx_bcast_recip_contact", "broadcast_recipients", ["broadcast_id", "contact_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_bcast_recip_contact", table_name="broadcast_recipients")
    op.drop_index("idx_bcast_recip_click", table_name="broadcast_recipients")
    op.drop_column("broadcast_recipients", "clicked_at")
    op.drop_column("broadcast_recipients", "clicked_button")
    op.drop_column("broadcasts", "template_params")
    op.drop_column("broadcasts", "template_lang")
    # Postgres can't drop an enum value; 'button' stays on flow_trigger.
