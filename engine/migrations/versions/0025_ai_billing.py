"""AI providers, per-feature models, token credits, and richer plans.

- ai_providers / ai_models: superadmin connects AI providers (API key encrypted with
  CHANNEL_CRED_KEY, same `enc:v1:` format as channel credentials) and lists models
  with a token multiplier ("potongan": tenant tokens charged per model token).
- ai_features: which model powers each AI feature (flow reply, simulator, embedding).
- ai_credit_packs: top-up packs the superadmin sells (e.g. 300k token, Rp15.000, 30 hari).
- ai_credit_buckets: a tenant's token balance, split into buckets that expire —
  the monthly plan allowance and every paid top-up. Usage drains the bucket that
  expires first.
- ai_usage: one row per AI call (tokens in/out, tokens charged) for reports.
- plans gain ai_tokens_monthly, limits (channels per type, agents, KB docs,
  broadcast), feature_flags and flow_nodes (allowed flow steps; NULL = all).
- tenants.plan_id links a tenant to the exact plan row it bought.
- orders.kind = 'plan' | 'ai_topup' so one checkout serves both.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0025_ai_billing"
down_revision: Union[str, None] = "0024_ai_default_to_flow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Existing plans keep working AI out of the box; superadmin tunes these later.
DEFAULT_MONTHLY_TOKENS = 300_000


def _id() -> sa.Column:
    return sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _ts(name: str) -> sa.Column:
    return sa.Column(name, sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()"))


def upgrade() -> None:
    op.create_table(
        "ai_providers",
        _id(),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("api_key", sa.Text, nullable=False),
        sa.Column("base_url", sa.Text),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        _ts("created_at"),
        _ts("updated_at"),
        sa.CheckConstraint(
            "kind IN ('anthropic', 'openai', 'openai_compatible')", name="ck_ai_provider_kind"
        ),
    )

    op.create_table(
        "ai_models",
        _id(),
        sa.Column(
            "provider_id", sa.Uuid, sa.ForeignKey("ai_providers.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("model", sa.Text, nullable=False),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("purpose", sa.Text, nullable=False, server_default="chat"),
        sa.Column("input_multiplier", sa.Numeric(10, 4), nullable=False, server_default="1"),
        sa.Column("output_multiplier", sa.Numeric(10, 4), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        _ts("created_at"),
        _ts("updated_at"),
        sa.UniqueConstraint("provider_id", "model", name="uq_ai_model_provider_model"),
        sa.CheckConstraint("purpose IN ('chat', 'embedding')", name="ck_ai_model_purpose"),
        sa.CheckConstraint(
            "input_multiplier >= 0 AND output_multiplier >= 0", name="ck_ai_model_multiplier"
        ),
    )

    op.create_table(
        "ai_features",
        sa.Column("feature", sa.Text, primary_key=True),
        sa.Column("model_id", sa.Uuid, sa.ForeignKey("ai_models.id", ondelete="SET NULL")),
        sa.Column("is_enabled", sa.Boolean, nullable=False, server_default=sa.true()),
        _ts("updated_at"),
    )
    op.execute(
        "INSERT INTO ai_features (feature) VALUES ('flow_reply'), ('simulator'), ('embedding')"
    )

    op.create_table(
        "ai_credit_packs",
        _id(),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("tokens", sa.BigInteger, nullable=False),
        sa.Column("price_idr", sa.BigInteger, nullable=False),
        sa.Column("valid_days", sa.Integer, nullable=False, server_default="30"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        _ts("created_at"),
        _ts("updated_at"),
        sa.CheckConstraint("tokens > 0 AND price_idr >= 0 AND valid_days > 0", name="ck_ai_pack_values"),
    )

    # orders first: buckets reference them.
    op.add_column("orders", sa.Column("kind", sa.Text, nullable=False, server_default="plan"))
    op.add_column(
        "orders",
        sa.Column("ai_pack_id", sa.Uuid, sa.ForeignKey("ai_credit_packs.id", ondelete="SET NULL")),
    )
    op.add_column("orders", sa.Column("ai_tokens", sa.BigInteger))
    op.add_column("orders", sa.Column("ai_valid_days", sa.Integer))
    op.create_check_constraint("ck_order_kind", "orders", "kind IN ('plan', 'ai_topup')")

    op.create_table(
        "ai_credit_buckets",
        _id(),
        sa.Column(
            "tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("source", sa.Text, nullable=False),
        sa.Column("tokens_total", sa.BigInteger, nullable=False),
        sa.Column("tokens_used", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("period_start", sa.TIMESTAMP(timezone=True)),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("order_id", sa.Uuid, sa.ForeignKey("orders.id", ondelete="SET NULL")),
        sa.Column("note", sa.Text),
        _ts("created_at"),
        sa.CheckConstraint("source IN ('plan', 'topup', 'bonus')", name="ck_ai_bucket_source"),
        sa.CheckConstraint("tokens_total >= 0 AND tokens_used >= 0", name="ck_ai_bucket_tokens"),
    )
    op.create_index("idx_ai_bucket_tenant_exp", "ai_credit_buckets", ["tenant_id", "expires_at"])
    # One plan allowance per tenant per month; one bucket per paid top-up order.
    op.create_index(
        "uq_ai_bucket_plan_period",
        "ai_credit_buckets",
        ["tenant_id", "period_start"],
        unique=True,
        postgresql_where=sa.text("source = 'plan'"),
    )
    op.create_index(
        "uq_ai_bucket_order",
        "ai_credit_buckets",
        ["order_id"],
        unique=True,
        postgresql_where=sa.text("order_id IS NOT NULL"),
    )

    op.create_table(
        "ai_usage",
        _id(),
        sa.Column(
            "tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("feature", sa.Text, nullable=False),
        sa.Column("model", sa.Text, nullable=False),
        sa.Column("input_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("charged_tokens", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("conversation_id", sa.Uuid),
        _ts("created_at"),
    )
    op.create_index("idx_ai_usage_tenant_time", "ai_usage", ["tenant_id", "created_at"])

    op.add_column(
        "plans",
        sa.Column(
            "ai_tokens_monthly",
            sa.BigInteger,
            nullable=False,
            server_default=str(DEFAULT_MONTHLY_TOKENS),
        ),
    )
    op.add_column(
        "plans",
        sa.Column("limits", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "plans",
        sa.Column(
            "feature_flags", postgresql.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
    )
    op.add_column("plans", sa.Column("flow_nodes", postgresql.JSONB))

    op.add_column(
        "tenants", sa.Column("plan_id", sa.Uuid, sa.ForeignKey("plans.id", ondelete="SET NULL"))
    )
    # Link tenants to the plan of their latest paid order when we know it.
    op.execute(
        """
        UPDATE tenants t SET plan_id = o.plan_id
        FROM (
            SELECT DISTINCT ON (tenant_id) tenant_id, plan_id
            FROM orders WHERE status = 'paid' AND plan_id IS NOT NULL
            ORDER BY tenant_id, paid_at DESC NULLS LAST
        ) o
        WHERE o.tenant_id = t.id
        """
    )


def downgrade() -> None:
    op.drop_column("tenants", "plan_id")
    op.drop_column("plans", "flow_nodes")
    op.drop_column("plans", "feature_flags")
    op.drop_column("plans", "limits")
    op.drop_column("plans", "ai_tokens_monthly")
    op.drop_index("idx_ai_usage_tenant_time", table_name="ai_usage")
    op.drop_table("ai_usage")
    op.drop_index("uq_ai_bucket_order", table_name="ai_credit_buckets")
    op.drop_index("uq_ai_bucket_plan_period", table_name="ai_credit_buckets")
    op.drop_index("idx_ai_bucket_tenant_exp", table_name="ai_credit_buckets")
    op.drop_table("ai_credit_buckets")
    op.drop_constraint("ck_order_kind", "orders")
    op.drop_column("orders", "ai_valid_days")
    op.drop_column("orders", "ai_tokens")
    op.drop_column("orders", "ai_pack_id")
    op.drop_column("orders", "kind")
    op.drop_table("ai_credit_packs")
    op.drop_table("ai_features")
    op.drop_table("ai_models")
    op.drop_table("ai_providers")
