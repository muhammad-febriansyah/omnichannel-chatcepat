"""user_avatar — kolom avatar_url di users (foto profil, dikelola self via web)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_user_avatar"
down_revision: Union[str, None] = "0003_billing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
