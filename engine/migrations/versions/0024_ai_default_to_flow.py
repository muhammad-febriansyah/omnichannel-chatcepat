"""AI Default → a "Cadangan" flow with an AI Agent node.

The engine no longer answers with the tenant's default AI outside flows: AI lives in
flows. To keep existing tenants answering exactly as before, every tenant that had
channels in "ai" / "hybrid" mode gets an active fallback flow built from its default
AI settings, limited to those channels. Their mode becomes "hybrid" (flow first).
Tenants that already have an active fallback flow keep it unchanged.
"""

import json
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_ai_default_to_flow"
down_revision: Union[str, None] = "0023_flow_comment_trigger"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FLOW_NAME = "CS AI 24 Jam"


def _ai_config(agent, document_ids: list[str]) -> tuple[dict, dict]:
    """Same settings in engine (snake_case) and canvas (camelCase) form."""
    examples = agent.examples if isinstance(agent.examples, list) else []
    engine = {
        "role": agent.role,
        "tone": agent.tone,
        "emoji": agent.emoji,
        "length": agent.length,
        "greeting": agent.greeting,
        "language": agent.language,
        "goal": agent.goal,
        "instructions": agent.instructions,
        "examples": examples,
        "handoff_rules": agent.handoff_rules,
        "fallback_message": agent.fallback_message,
        "knowledge_all": agent.knowledge_all,
        "document_ids": document_ids,
        "use_catalog": agent.use_catalog,
        "use_promos": agent.use_promos,
    }
    canvas = {
        "role": agent.role,
        "tone": agent.tone,
        "emoji": agent.emoji,
        "length": agent.length,
        "greeting": agent.greeting,
        "language": agent.language,
        "goal": agent.goal or "",
        "instructions": agent.instructions or "",
        "examples": examples,
        "handoffRules": agent.handoff_rules or "",
        "fallbackMessage": agent.fallback_message or "",
        "knowledgeAll": agent.knowledge_all,
        "documentIds": document_ids,
        "useCatalog": agent.use_catalog,
        "usePromos": agent.use_promos,
    }
    return engine, canvas


def upgrade() -> None:
    conn = op.get_bind()
    tenants = conn.execute(
        sa.text(
            """
            SELECT tenant_id, array_agg(id::text ORDER BY created_at) AS channel_ids
            FROM channels
            WHERE auto_reply_mode IN ('ai', 'hybrid')
            GROUP BY tenant_id
            """
        )
    ).all()

    for tenant_id, channel_ids in tenants:
        has_fallback = conn.execute(
            sa.text(
                "SELECT 1 FROM flows WHERE tenant_id = :t AND status = 'active' AND trigger = 'fallback' LIMIT 1"
            ),
            {"t": tenant_id},
        ).first()
        agent = conn.execute(
            sa.text(
                "SELECT * FROM ai_agents WHERE tenant_id = :t AND is_default AND is_active LIMIT 1"
            ),
            {"t": tenant_id},
        ).first()
        if has_fallback or agent is None:
            continue

        doc_ids = [
            str(r[0])
            for r in conn.execute(
                sa.text("SELECT document_id FROM ai_agent_knowledge WHERE agent_id = :a AND tenant_id = :t"),
                {"a": agent.id, "t": tenant_id},
            )
        ]
        engine_ai, canvas_ai = _ai_config(agent, doc_ids)
        channels = list(channel_ids)
        definition = {
            "nodes": [
                {
                    "id": "start",
                    "type": "trigger",
                    "trigger": {"kind": "fallback", "match": [], "channels": channels},
                    "next": "ai",
                },
                {"id": "ai", "type": "ai_agent", "ai": engine_ai, "next": None, "handoff_next": None},
            ],
            "ui": {
                "nodes": [
                    {
                        "id": "start",
                        "type": "trigger",
                        "position": {"x": 0, "y": 0},
                        "data": {"kind": "fallback", "keywords": [], "channels": channels, "posts": []},
                    },
                    {"id": "ai", "type": "ai_agent", "position": {"x": 0, "y": 190}, "data": {"ai": canvas_ai}},
                ],
                "edges": [{"id": "e_start_ai", "source": "start", "sourceHandle": "out", "target": "ai"}],
            },
        }
        conn.execute(
            sa.text(
                """
                INSERT INTO flows (id, tenant_id, name, status, trigger, definition)
                VALUES (:id, :t, :name, 'active', 'fallback', CAST(:d AS jsonb))
                """
            ),
            {"id": uuid.uuid4(), "t": tenant_id, "name": FLOW_NAME, "d": json.dumps(definition)},
        )

    # "ai" skipped flows entirely; now everything is flow-first.
    op.execute("UPDATE channels SET auto_reply_mode = 'hybrid' WHERE auto_reply_mode = 'ai'")


def downgrade() -> None:
    # Data migration: generated flows stay (they are ordinary, editable flows).
    pass
