"""products — katalog produk tenant (docs/prd/06 auto-reply + balas katalog).

Tabel milik web (CRUD via Drizzle). Engine pegang DDL (skema = satu pemilik).
Sumber balasan otomatis: node flow `send_catalog` + konteks AI agent.
Uang = BIGINT rupiah penuh (no float). Foto = array URL upload (multi-foto).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_products"
down_revision: Union[str, None] = "0006_roles_2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "products",
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
        sa.Column("description", sa.Text),
        sa.Column("price_idr", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("sku", sa.Text),
        sa.Column("stock", sa.Integer, nullable=False, server_default="0"),
        sa.Column("category", sa.Text),
        sa.Column(
            "photos",
            sa.ARRAY(sa.Text),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
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
    # Index komposit diawali tenant_id (root CLAUDE). Lookup aktif + filter kategori.
    op.create_index(
        "idx_product_lookup", "products", ["tenant_id", "active", "category"]
    )
    # SKU unik per tenant (abaikan NULL).
    op.execute(
        "CREATE UNIQUE INDEX uq_product_sku ON products (tenant_id, sku) "
        "WHERE sku IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("idx_product_lookup", table_name="products")
    op.drop_table("products")
