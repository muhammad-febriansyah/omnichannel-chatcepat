"""Referral program: tenants refer new signups and earn commission on their first paid plan.

- referral_settings: one global row (platform admin) — percent, hold days, minimum payout.
- referral_accounts: a tenant's referral code + payout bank details (one per tenant).
- referrals: who referred which tenant. Set once at signup, never changed.
- referral_commissions: one row per paid order that earned commission (order_id unique →
  duplicate payment callbacks can't create two). Amounts are snapshots.
- referral_payouts: withdrawal requests, paid manually by the platform admin.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0030_referrals"
down_revision: Union[str, None] = "0029_knowledge_faq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts(name: str) -> sa.Column:
    return sa.Column(name, sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()"))


def upgrade() -> None:
    op.create_table(
        "referral_settings",
        sa.Column("id", sa.SmallInteger, primary_key=True, server_default="1"),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("commission_percent", sa.SmallInteger, nullable=False, server_default="20"),
        sa.Column("hold_days", sa.Integer, nullable=False, server_default="14"),
        sa.Column("min_payout_idr", sa.BigInteger, nullable=False, server_default="100000"),
        _ts("updated_at"),
        sa.CheckConstraint("id = 1", name="ck_referral_settings_singleton"),
        sa.CheckConstraint("commission_percent BETWEEN 0 AND 100", name="ck_referral_settings_percent"),
        sa.CheckConstraint("hold_days >= 0 AND min_payout_idr >= 0", name="ck_referral_settings_nonneg"),
    )
    op.execute("INSERT INTO referral_settings (id) VALUES (1)")

    op.create_table(
        "referral_accounts",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("bank_name", sa.Text),
        sa.Column("account_number", sa.Text),
        sa.Column("account_name", sa.Text),
        _ts("created_at"),
        _ts("updated_at"),
        sa.CheckConstraint("code ~ '^[A-Z0-9]{4,20}$'", name="ck_referral_accounts_code"),
    )
    op.create_index("uq_referral_accounts_tenant", "referral_accounts", ["tenant_id"], unique=True)
    op.create_index("uq_referral_accounts_code", "referral_accounts", ["code"], unique=True)

    op.create_table(
        "referrals",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        # tenant_id = the referrer (owner of the code).
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referred_tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="pending"),
        sa.Column("converted_at", sa.TIMESTAMP(timezone=True)),
        _ts("created_at"),
        sa.CheckConstraint("status IN ('pending', 'converted', 'void')", name="ck_referrals_status"),
        sa.CheckConstraint("tenant_id <> referred_tenant_id", name="ck_referrals_not_self"),
    )
    op.create_index("uq_referrals_referred", "referrals", ["referred_tenant_id"], unique=True)
    op.create_index("idx_referrals_tenant", "referrals", ["tenant_id", "created_at"])

    op.create_table(
        "referral_payouts",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_idr", sa.BigInteger, nullable=False),
        # Bank details are copied at request time so later edits don't change history.
        sa.Column("bank_name", sa.Text, nullable=False),
        sa.Column("account_number", sa.Text, nullable=False),
        sa.Column("account_name", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="requested"),
        sa.Column("note", sa.Text),
        sa.Column("requested_by", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("processed_by", sa.Uuid, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("processed_at", sa.TIMESTAMP(timezone=True)),
        _ts("created_at"),
        _ts("updated_at"),
        sa.CheckConstraint("status IN ('requested', 'paid', 'rejected')", name="ck_referral_payouts_status"),
        sa.CheckConstraint("amount_idr > 0", name="ck_referral_payouts_amount"),
    )
    op.create_index("idx_referral_payouts_tenant", "referral_payouts", ["tenant_id", "created_at"])
    op.create_index("idx_referral_payouts_status", "referral_payouts", ["status", "created_at"])
    # At most one open request per tenant.
    op.create_index(
        "uq_referral_payouts_open", "referral_payouts", ["tenant_id"], unique=True,
        postgresql_where=sa.text("status = 'requested'"),
    )

    op.create_table(
        "referral_commissions",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        # tenant_id = the referrer who earns it.
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referral_id", sa.Uuid, sa.ForeignKey("referrals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referred_tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="SET NULL")),
        sa.Column("order_id", sa.Uuid, sa.ForeignKey("orders.id", ondelete="SET NULL")),
        sa.Column("referred_name", sa.Text, nullable=False),
        sa.Column("plan_name", sa.Text, nullable=False),
        sa.Column("order_amount_idr", sa.BigInteger, nullable=False),
        sa.Column("commission_percent", sa.SmallInteger, nullable=False),
        sa.Column("commission_idr", sa.BigInteger, nullable=False),
        sa.Column("status", sa.Text, nullable=False, server_default="earned"),
        sa.Column("available_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("payout_id", sa.Uuid, sa.ForeignKey("referral_payouts.id", ondelete="SET NULL")),
        sa.Column("void_reason", sa.Text),
        _ts("created_at"),
        _ts("updated_at"),
        sa.CheckConstraint("status IN ('earned', 'paid', 'void')", name="ck_referral_commissions_status"),
        sa.CheckConstraint("commission_idr >= 0", name="ck_referral_commissions_amount"),
    )
    op.create_index("uq_referral_commissions_order", "referral_commissions", ["order_id"], unique=True)
    op.create_index("idx_referral_commissions_tenant", "referral_commissions", ["tenant_id", "status", "available_at"])
    op.create_index("idx_referral_commissions_payout", "referral_commissions", ["payout_id"])


def downgrade() -> None:
    op.drop_table("referral_commissions")
    op.drop_table("referral_payouts")
    op.drop_table("referrals")
    op.drop_table("referral_accounts")
    op.drop_table("referral_settings")
