"""tambah tier 'basic' ke enum tenant_plan (pricing Basic/Pro/Enterprise).

Tier aktif jadi: basic (249k) < pro (449k) < enterprise (749k). Nilai lama
'business' dibiarkan (tak ditawarkan lagi; hindari remap data existing).
ADD VALUE tak bisa di dalam transaksi → pakai autocommit_block. docs/prd/01.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0009_plan_basic"
down_revision: Union[str, None] = "0008_channel_auto_reply"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'basic' BEFORE 'pro'")


def downgrade() -> None:
    # Postgres tak mendukung DROP VALUE pada enum secara langsung → no-op.
    pass
