"""Indexes for the tenant dashboard.

The dashboard counts messages, conversations and contacts of one tenant inside a
date range. Without (tenant_id, created_at) indexes those queries scan every row of
the table. Built CONCURRENTLY so a large messages table keeps accepting writes.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0027_dashboard_indexes"
down_revision: Union[str, None] = "0026_broadcast_flows"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEXES = (
    ("idx_msg_tenant_time", "messages"),
    ("idx_conv_tenant_time", "conversations"),
    ("idx_contact_tenant_time", "contacts"),
)


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table in _INDEXES:
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} (tenant_id, created_at)")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _table in _INDEXES:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
