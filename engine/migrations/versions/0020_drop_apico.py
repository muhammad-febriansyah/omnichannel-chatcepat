"""Drop api.co.id (apico) integration.

WhatsApp Official, Instagram and Facebook now connect straight to the Meta Graph
API. Legacy apico channels cannot be converted (their external_id is an apico
record id and credentials hold no Meta access token), so they are disconnected
and their credentials scrubbed. Conversations/messages stay as history; tenants
reconnect through Embedded Signup / Facebook OAuth, which creates new channels.

Also drops the operator-managed `wa_official_requests` onboarding table, which
only existed to assign apico numbers.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0020_drop_apico"
down_revision: Union[str, None] = "0019_order_period"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # external_id is cleared so the old apico record id can never match a Meta
    # webhook; legacy_provider keeps an audit trail.
    op.execute(
        """
        UPDATE channels
           SET status = 'disconnected',
               auto_reply_enabled = false,
               credentials = '{}'::jsonb,
               external_id = NULL,
               meta = (meta - 'provider') || '{"legacy_provider": "apico"}'::jsonb,
               updated_at = now()
         WHERE meta->>'provider' = 'apico'
        """
    )
    op.drop_table("wa_official_requests")
    op.execute("DROP TYPE IF EXISTS wa_request_status")


def downgrade() -> None:
    # Only the table is restored; scrubbed apico channels cannot be recovered.
    op.execute("CREATE TYPE wa_request_status AS ENUM ('pending', 'in_review', 'approved', 'rejected')")
    op.create_table(
        "wa_official_requests",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_name", sa.Text, nullable=False),
        sa.Column("phone_number", sa.Text, nullable=False),
        sa.Column("contact_name", sa.Text),
        sa.Column("notes", sa.Text),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending", "in_review", "approved", "rejected", name="wa_request_status", create_type=False
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("channel_id", sa.Uuid, sa.ForeignKey("channels.id", ondelete="SET NULL")),
        sa.Column("external_id", sa.Text),
        sa.Column("reviewed_by", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_wa_request_tenant", "wa_official_requests", ["tenant_id", "created_at"])
    op.create_index("idx_wa_request_status", "wa_official_requests", ["status", "created_at"])
