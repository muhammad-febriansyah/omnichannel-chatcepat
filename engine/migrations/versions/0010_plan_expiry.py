"""tenants.plan_expires_at — tanggal berakhir langganan (reminder + auto-downgrade).

NULL = tanpa batas (tenant lama/seed grandfathered, tak pernah di-downgrade).
Diisi saat pembayaran sukses (callback Duitku). docs/prd/01.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_plan_expiry"
down_revision: Union[str, None] = "0009_plan_basic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("plan_expires_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("tenants", "plan_expires_at")
