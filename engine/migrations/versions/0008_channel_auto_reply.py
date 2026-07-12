"""channel auto_reply toggle — balas otomatis per-channel (flow + AI).

Default ON. wa_unofficial di-backfill OFF: balasan otomatis dari nomor pribadi
memicu deteksi spam WA (rawan banned) — sebelumnya di-hardcode skip di engine.
Sekarang dikontrol toggle; unofficial harus opt-in sadar risiko. docs/prd/05,06.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_channel_auto_reply"
down_revision: Union[str, None] = "0007_products"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "channels",
        sa.Column(
            "auto_reply_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    # Pertahankan perilaku lama: wa_unofficial tak pernah auto-reply → default OFF.
    op.execute("UPDATE channels SET auto_reply_enabled = false WHERE type = 'wa_unofficial'")


def downgrade() -> None:
    op.drop_column("channels", "auto_reply_enabled")
