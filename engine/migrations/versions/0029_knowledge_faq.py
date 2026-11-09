"""Knowledge FAQ + questions the AI could not answer.

- knowledge_faqs: question/answer pairs written by the business (web). The AI gives
  them priority over documents, so answers stay consistent.
- ai_unanswered: questions the AI had no data for (engine). Same question (normalized)
  is counted, not duplicated; the owner answers it (→ FAQ) or ignores it.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029_knowledge_faq"
down_revision: Union[str, None] = "0028_assistant_fallback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_faqs",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("answer", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_faq_tenant", "knowledge_faqs", ["tenant_id", "created_at"])

    op.create_table(
        "ai_unanswered",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", sa.Uuid, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("question_norm", sa.Text, nullable=False),
        sa.Column("conversation_id", sa.Uuid, sa.ForeignKey("conversations.id", ondelete="SET NULL")),
        sa.Column("ask_count", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", sa.Text, nullable=False, server_default="open"),
        sa.Column("faq_id", sa.Uuid, sa.ForeignKey("knowledge_faqs.id", ondelete="SET NULL")),
        sa.Column("last_asked_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('open', 'answered', 'ignored')", name="ck_ai_unanswered_status"),
    )
    op.create_index("uq_ai_unanswered_q", "ai_unanswered", ["tenant_id", "question_norm"], unique=True)
    op.create_index("idx_ai_unanswered_open", "ai_unanswered", ["tenant_id", "status", "last_asked_at"])


def downgrade() -> None:
    op.drop_index("idx_ai_unanswered_open", table_name="ai_unanswered")
    op.drop_index("uq_ai_unanswered_q", table_name="ai_unanswered")
    op.drop_table("ai_unanswered")
    op.drop_index("idx_faq_tenant", table_name="knowledge_faqs")
    op.drop_table("knowledge_faqs")
