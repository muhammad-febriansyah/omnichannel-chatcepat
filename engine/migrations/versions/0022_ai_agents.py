"""AI agents with reply styles, per-agent knowledge, and active promos.

- ai_agents: a tenant can run several agents (CS, sales, promo, social comments),
  each with a reply style (tone, emoji, length, greeting, language), custom
  instructions, example Q&A, and handoff rules. One agent per tenant is default.
- ai_agent_knowledge: which knowledge documents an agent may use (when it does
  not use the whole knowledge base).
- promos: active promotions the AI is allowed to mention (with a validity window),
  so it never invents discounts.
- channels.ai_agent_id: which agent answers on a channel (null = tenant default).

The old single persona (tenants.settings.ai_persona) becomes each tenant's default
agent so existing behaviour is kept.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022_ai_agents"
down_revision: Union[str, None] = "0021_broadcast_buttons"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ts():
    return [
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    ]


def upgrade() -> None:
    op.create_table(
        "ai_agents",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("role", sa.Text, nullable=False, server_default="cs"),
        sa.Column("tone", sa.Text, nullable=False, server_default="ramah"),
        sa.Column("emoji", sa.Text, nullable=False, server_default="sedikit"),
        sa.Column("length", sa.Text, nullable=False, server_default="pendek"),
        sa.Column("greeting", sa.Text, nullable=False, server_default="kak"),
        sa.Column("language", sa.Text, nullable=False, server_default="auto"),
        sa.Column("goal", sa.Text),
        sa.Column("instructions", sa.Text),
        sa.Column("examples", postgresql.JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("handoff_rules", sa.Text),
        sa.Column("fallback_message", sa.Text),
        sa.Column("knowledge_all", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("use_catalog", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("use_promos", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        *_ts(),
        sa.CheckConstraint("role IN ('cs','sales','reservasi','promosi','sosial')", name="ck_ai_agent_role"),
        sa.CheckConstraint(
            "tone IN ('ramah','profesional','promosi','santai','singkat','empatik')", name="ck_ai_agent_tone"
        ),
        sa.CheckConstraint("emoji IN ('tanpa','sedikit','banyak')", name="ck_ai_agent_emoji"),
        sa.CheckConstraint("length IN ('pendek','sedang')", name="ck_ai_agent_length"),
        sa.CheckConstraint("greeting IN ('kak','bapak_ibu','nama')", name="ck_ai_agent_greeting"),
        sa.CheckConstraint("language IN ('auto','id','en')", name="ck_ai_agent_language"),
    )
    op.create_index("idx_ai_agent_tenant", "ai_agents", ["tenant_id", "created_at"])
    # At most one default agent per tenant.
    op.execute("CREATE UNIQUE INDEX uq_ai_agent_default ON ai_agents (tenant_id) WHERE is_default")

    op.create_table(
        "ai_agent_knowledge",
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.Uuid, sa.ForeignKey("ai_agents.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "document_id", sa.Uuid, sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    op.create_index("idx_ai_agent_knowledge_tenant", "ai_agent_knowledge", ["tenant_id", "agent_id"])

    op.create_table(
        "promos",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("code", sa.Text),
        sa.Column("starts_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("ends_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        *_ts(),
    )
    op.create_index("idx_promo_tenant", "promos", ["tenant_id", "is_active", "ends_at"])

    op.add_column(
        "channels",
        sa.Column("ai_agent_id", sa.Uuid, sa.ForeignKey("ai_agents.id", ondelete="SET NULL")),
    )

    # Keep existing behaviour: the old tenant persona becomes the default agent.
    op.execute(
        """
        INSERT INTO ai_agents (tenant_id, name, instructions, is_default)
        SELECT id, 'Asisten Utama', NULLIF(btrim(settings->>'ai_persona'), ''), true
          FROM tenants
        """
    )


def downgrade() -> None:
    op.drop_column("channels", "ai_agent_id")
    op.drop_index("idx_promo_tenant", table_name="promos")
    op.drop_table("promos")
    op.drop_index("idx_ai_agent_knowledge_tenant", table_name="ai_agent_knowledge")
    op.drop_table("ai_agent_knowledge")
    op.execute("DROP INDEX IF EXISTS uq_ai_agent_default")
    op.drop_index("idx_ai_agent_tenant", table_name="ai_agents")
    op.drop_table("ai_agents")
