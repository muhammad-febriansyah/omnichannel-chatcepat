"""Unit test AI agent (06): memori percakapan + eskalasi low-confidence.

Tanpa DB: `messages_repo.recent_turns` di-monkeypatch, provider di-inject via
`llm.set_provider`. Provider embed raise NotImplementedError → jalur RAG dilewati.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.ai import agent
from app.ai import llm
from app.config import AI_ESCALATION_MESSAGE


class FakeProvider:
    enabled = True

    def __init__(self, reply: str) -> None:
        self.reply = reply
        self.seen_history: list[dict] | None = None
        self.seen_user: str | None = None

    async def complete(self, system, user, history=None):
        self.seen_history = history
        self.seen_user = user
        return self.reply

    async def embed(self, text):
        raise NotImplementedError  # paksa lewati RAG


def _msg(direction: str, body: str):
    return SimpleNamespace(direction=direction, body=body)


def _fixtures():
    conv = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4(), handler="bot")
    channel = SimpleNamespace(meta={})
    contact = SimpleNamespace()
    inbound = SimpleNamespace(body="berapa harga paket A?")
    return conv, channel, contact, inbound


@pytest.fixture(autouse=True)
def _reset_provider():
    yield
    llm.reset_provider()


async def test_escalation_sentinel_triggers_handoff(monkeypatch):
    monkeypatch.setattr(agent.messages_repo, "recent_turns", _noop_history)
    llm.set_provider(FakeProvider(reply=f"  {agent._HANDOFF_SENTINEL}  "))

    conv, channel, contact, inbound = _fixtures()
    res = await agent.try_ai(None, conv, channel, contact, inbound)

    assert res is not None
    assert res.handoff is True
    assert res.reply == AI_ESCALATION_MESSAGE


async def test_normal_reply_no_handoff(monkeypatch):
    monkeypatch.setattr(agent.messages_repo, "recent_turns", _noop_history)
    llm.set_provider(FakeProvider(reply="Paket A Rp50.000."))

    conv, channel, contact, inbound = _fixtures()
    res = await agent.try_ai(None, conv, channel, contact, inbound)

    assert res is not None
    assert res.handoff is False
    assert res.reply == "Paket A Rp50.000."


async def test_history_excludes_current_inbound(monkeypatch):
    # recent_turns mengembalikan: turn lama + inbound terkini (duplikat query).
    async def _history(session, conv_id, limit):
        return [
            _msg("inbound", "halo"),
            _msg("outbound", "Halo! Ada yang bisa dibantu?"),
            _msg("inbound", "berapa harga paket A?"),  # = query terkini → harus dibuang
        ]

    monkeypatch.setattr(agent.messages_repo, "recent_turns", _history)
    provider = FakeProvider(reply="Rp50.000.")
    llm.set_provider(provider)

    conv, channel, contact, inbound = _fixtures()
    await agent.try_ai(None, conv, channel, contact, inbound)

    assert provider.seen_history == [
        {"role": "user", "content": "halo"},
        {"role": "assistant", "content": "Halo! Ada yang bisa dibantu?"},
    ]
    assert provider.seen_user == "berapa harga paket A?"


async def test_ai_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(agent.messages_repo, "recent_turns", _noop_history)
    llm.set_provider(None)

    conv, channel, contact, inbound = _fixtures()
    assert await agent.try_ai(None, conv, channel, contact, inbound) is None


async def _noop_history(session, conv_id, limit):
    return []
