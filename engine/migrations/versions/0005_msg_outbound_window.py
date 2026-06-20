"""msg_outbound_window — index utk hitung outbound per channel/rolling-window.

Mendukung warmup + daily cap anti-banned (07): COUNT(*) outbound per channel
sejak `since`. Partial index (hanya direction='outbound') agar ramping & kecil.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005_msg_outbound_window"
down_revision: Union[str, None] = "0004_user_avatar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX idx_msg_outbound_window ON messages (channel_id, created_at) "
        "WHERE direction = 'outbound'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_msg_outbound_window")
