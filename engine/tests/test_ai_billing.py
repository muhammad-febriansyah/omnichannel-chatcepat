"""AI token billing: cost math, metered calls without DB, quota → handoff."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.ai import agent, llm, metered
from app.config import AI_ESCALATION_MESSAGE
from app.repositories import ai_billing


def test_cost_rounds_up_with_multipliers():
    assert ai_billing.cost(1500, 200, 1.0, 1.0) == 1700
    assert ai_billing.cost(1500, 200, 0.5, 4.0) == 1550
    assert ai_billing.cost(1, 0, 0.1, 1.0) == 1  # never free when tokens were used
    assert ai_billing.cost(0, 0, 3.0, 3.0) == 0


class Fake:
    enabled = True

    async def complete(self, system, user, history=None):
        return "halo kak"

    async def embed(self, text):
        raise NotImplementedError


@pytest.fixture(autouse=True)
def _provider():
    llm.set_provider(Fake())
    yield
    llm.reset_provider()


async def test_metered_chat_without_db_estimates_usage():
    res = await metered.chat(None, uuid.uuid4(), "flow_reply", "sistem " * 40, "harga?")
    assert res.text == "halo kak"
    assert res.input_tokens > 0 and res.output_tokens > 0


async def test_try_ai_hands_over_when_tokens_run_out(monkeypatch):
    async def empty(_session, _tenant):
        return False

    monkeypatch.setattr(metered, "has_balance", empty)
    conv = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4(), handler="bot")
    res = await agent.try_ai(None, conv, SimpleNamespace(meta={}), SimpleNamespace(), SimpleNamespace(body="halo"))
    assert res.handoff is True
    assert res.reply == AI_ESCALATION_MESSAGE
