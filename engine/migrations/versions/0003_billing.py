"""billing — plans (pricing global, dikelola super-admin) + orders (Duitku).

Tabel milik web (CRUD via Drizzle). Engine pegang DDL (skema = satu pemilik).
`plans` global (tanpa tenant_id) = konfigurasi platform. `orders` tenant-scoped,
nilai paket di-snapshot (plan_name, tier, amount) supaya tahan walau plan dihapus.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_billing"
down_revision: Union[str, None] = "0002_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUMS = {
    "order_status": ("pending", "paid", "failed", "expired"),
}


def upgrade() -> None:
    for name, values in ENUMS.items():
        vals = ", ".join(f"'{v}'" for v in values)
        op.execute(f"CREATE TYPE {name} AS ENUM ({vals})")

    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        # tier = paket yang di-set ke tenants.plan saat order lunas.
        sa.Column(
            "tier",
            postgresql.ENUM("pro", "business", "enterprise", name="tenant_plan", create_type=False),
            nullable=False,
            server_default="pro",
        ),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("slug", sa.Text, nullable=False),
        sa.Column("price_idr", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("period", sa.Text, nullable=False, server_default="month"),  # month | year
        sa.Column("quota", sa.Integer),  # null = unlimited
        sa.Column("description", sa.Text),
        sa.Column("features", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("highlight", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("CREATE UNIQUE INDEX uq_plan_slug ON plans (slug)")
    op.create_index("idx_plan_active", "plans", ["is_active", "sort_order"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", sa.Uuid, sa.ForeignKey("plans.id", ondelete="SET NULL")),
        # snapshot nilai transaksi (PRD: jangan join ke master yang berubah).
        sa.Column("plan_name", sa.Text, nullable=False),
        sa.Column(
            "tier",
            postgresql.ENUM("pro", "business", "enterprise", name="tenant_plan", create_type=False),
            nullable=False,
        ),
        sa.Column("amount_idr", sa.BigInteger, nullable=False),
        sa.Column("merchant_order_id", sa.Text, nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(*ENUMS["order_status"], name="order_status", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("duitku_reference", sa.Text),
        sa.Column("payment_url", sa.Text),
        sa.Column("payment_method", sa.Text),
        sa.Column("customer_name", sa.Text),
        sa.Column("customer_email", sa.Text),
        sa.Column("paid_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("raw", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("CREATE UNIQUE INDEX uq_order_merchant_order_id ON orders (merchant_order_id)")
    op.create_index("idx_order_tenant", "orders", ["tenant_id", "created_at"])


def downgrade() -> None:
    op.drop_table("orders")
    op.drop_table("plans")
    for name in ENUMS:
        op.execute(f"DROP TYPE IF EXISTS {name}")
