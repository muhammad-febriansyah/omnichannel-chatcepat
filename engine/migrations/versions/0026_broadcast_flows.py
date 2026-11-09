"""Broadcast as a flow trigger.

A flow with trigger 'broadcast' sends its first message (node "Pesan Broadcast")
to opted-in contacts of one WhatsApp account at a scheduled time. Activating the
flow creates a broadcasts row linked back to the flow; replies and button taps
continue the flow from that message.

- flow_trigger gains 'broadcast'
- broadcast_status gains 'cancelled' (flow deactivated before the send time)
- broadcasts.flow_id / flow_node_id link a broadcast to the flow step it sent
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0026_broadcast_flows"
down_revision: Union[str, None] = "0025_ai_billing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE can't run inside a transaction block on older PG.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE flow_trigger ADD VALUE IF NOT EXISTS 'broadcast'")
        op.execute("ALTER TYPE broadcast_status ADD VALUE IF NOT EXISTS 'cancelled'")
    op.add_column(
        "broadcasts",
        sa.Column(
            "flow_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("flows.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("broadcasts", sa.Column("flow_node_id", sa.Text(), nullable=True))
    op.create_index("ix_broadcasts_tenant_flow", "broadcasts", ["tenant_id", "flow_id"])
    # Worker polls due scheduled broadcasts across tenants.
    op.create_index(
        "ix_broadcasts_scheduled_due",
        "broadcasts",
        ["scheduled_at"],
        postgresql_where=sa.text("status = 'scheduled'"),
    )


def downgrade() -> None:
    op.drop_index("ix_broadcasts_scheduled_due", table_name="broadcasts")
    op.drop_index("ix_broadcasts_tenant_flow", table_name="broadcasts")
    op.drop_column("broadcasts", "flow_node_id")
    op.drop_column("broadcasts", "flow_id")
    # Postgres can't drop enum values; 'broadcast' / 'cancelled' stay.
