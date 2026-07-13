"""wa_official_requests — pengajuan WhatsApp Official oleh tenant, di-onboard operator.

Tenant tak bisa self-onboard nomor WA Official (embedded signup ada di sisi
provider api.co.id). Jadi: tenant ajukan lewat dashboard → operator (admin
platform) onboard nomor di api.co.id → assign ke tenant (bikin channel apico).
Tabel milik web (CRUD via Drizzle); engine pegang DDL (skema = satu pemilik).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_wa_official_requests"
down_revision: Union[str, None] = "0010_plan_expiry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUMS = {
    "wa_request_status": ("pending", "in_review", "approved", "rejected"),
}


def upgrade() -> None:
    for name, values in ENUMS.items():
        vals = ", ".join(f"'{v}'" for v in values)
        op.execute(f"CREATE TYPE {name} AS ENUM ({vals})")

    op.create_table(
        "wa_official_requests",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        # Data pengajuan (yang diinput tenant).
        sa.Column("business_name", sa.Text, nullable=False),
        sa.Column("phone_number", sa.Text, nullable=False),  # nomor yang diinginkan (E.164)
        sa.Column("contact_name", sa.Text),
        sa.Column("notes", sa.Text),
        sa.Column(
            "status",
            postgresql.ENUM(*ENUMS["wa_request_status"], name="wa_request_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        # Hasil review operator.
        sa.Column("channel_id", sa.Uuid, sa.ForeignKey("channels.id", ondelete="SET NULL")),
        sa.Column("external_id", sa.Text),  # id nomor api.co.id yang di-assign
        sa.Column("reviewed_by", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    # Index komposit diawali tenant_id (aturan root CLAUDE.md), keyset by created_at.
    op.create_index("idx_wa_request_tenant", "wa_official_requests", ["tenant_id", "created_at"])
    op.create_index("idx_wa_request_status", "wa_official_requests", ["status", "created_at"])


def downgrade() -> None:
    op.drop_table("wa_official_requests")
    for name in ENUMS:
        op.execute(f"DROP TYPE IF EXISTS {name}")
