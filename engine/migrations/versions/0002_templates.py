"""templates — WA HSM + balasan cepat (docs/prd/08 Template Pesan)

Tabel milik web (CRUD via Drizzle). Engine pegang DDL (skema = satu pemilik).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_templates"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUMS = {
    "template_kind": ("hsm", "quick_reply"),
    "template_status": ("draft", "approved", "rejected"),
}


def upgrade() -> None:
    for name, values in ENUMS.items():
        vals = ", ".join(f"'{v}'" for v in values)
        op.execute(f"CREATE TYPE {name} AS ENUM ({vals})")

    op.create_table(
        "templates",
        sa.Column(
            "id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "tenant_id",
            sa.Uuid,
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM(*ENUMS["template_kind"], name="template_kind", create_type=False),
            nullable=False,
            server_default="quick_reply",
        ),
        sa.Column("category", sa.Text),  # HSM: MARKETING/UTILITY/AUTHENTICATION
        sa.Column("language", sa.Text),  # HSM: id, en_US, ...
        sa.Column("body", sa.Text, nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(*ENUMS["template_status"], name="template_status", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.execute("CREATE UNIQUE INDEX uq_template_name ON templates (tenant_id, name)")
    op.create_index("idx_template_lookup", "templates", ["tenant_id", "kind"])


def downgrade() -> None:
    op.drop_table("templates")
    for name in ENUMS:
        op.execute(f"DROP TYPE IF EXISTS {name}")
