"""roles_2 — sederhanakan user_role jadi 2: admin (platform) + client (tenant).

Remap data:
  super_admin              -> admin   (operator platform, god-mode)
  admin / supervisor / agent -> client (akun tenant, akses penuh workspace)

Enum Postgres tak bisa di-ALTER nilai langsung → swap via kolom text sementara.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0006_roles_2"
down_revision: Union[str, None] = "0005_msg_outbound_window"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE text")
    # Urutan penting: admin LAMA (tenant) → client dulu, baru super_admin → admin.
    op.execute(
        "UPDATE users SET role = 'client' WHERE role IN ('admin', 'supervisor', 'agent')"
    )
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'super_admin'")
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'client')")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role")
    op.execute("DROP TYPE user_role_old")


def downgrade() -> None:
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE text")
    # Setelah upgrade semua 'admin' = platform → super_admin; 'client' → admin.
    # Info supervisor/agent tak bisa dipulihkan (lossy).
    op.execute("UPDATE users SET role = 'super_admin' WHERE role = 'admin'")
    op.execute("UPDATE users SET role = 'admin' WHERE role = 'client'")
    op.execute("ALTER TYPE user_role RENAME TO user_role_old")
    op.execute("CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'supervisor', 'agent')")
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role")
    op.execute("DROP TYPE user_role_old")
