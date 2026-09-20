"""Add single-use password reset tokens for the web authentication flow."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_password_reset_tokens"
down_revision: Union[str, None] = "0012_omnichannel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text, nullable=False, unique=True),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_password_reset_token_user", "password_reset_tokens", ["user_id", "created_at"])
    op.create_index("idx_password_reset_token_expiry", "password_reset_tokens", ["expires_at", "used_at"])


def downgrade() -> None:
    op.drop_index("idx_password_reset_token_expiry", table_name="password_reset_tokens")
    op.drop_index("idx_password_reset_token_user", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
