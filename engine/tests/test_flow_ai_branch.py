"""AI node "Perlu CS" branch: wired → flow continues there; unwired → stock handoff."""

from __future__ import annotations

from types import SimpleNamespace

from app.ai.agent import AIResult
from app.pipeline import flow_engine


def _flow(handoff_next):
    nodes = [
        {"id": "t", "type": "trigger", "next": "ai"},
        {"id": "ai", "type": "ai_agent", "ai": {"tone": "ramah"}, "next": None, "handoff_next": handoff_next},
        {"id": "ask", "type": "send_text", "text": "Boleh minta nomor pesanannya kak?", "next": None},
    ]
    return SimpleNamespace(definition={"nodes": nodes})


async def _walk(monkeypatch, flow):
    async def fake_try_ai(*_a, **_k):
        return AIResult(reply="Baik, saya hubungkan dengan agen kami.", handoff=True)

    monkeypatch.setattr(flow_engine.ai, "try_ai", fake_try_ai)
    outcome = flow_engine.FlowOutcome()
    wait, ended = await flow_engine._walk(None, None, None, None, None, flow, "t", {}, outcome)
    return outcome, wait, ended


async def test_wired_handoff_branch_continues_flow(monkeypatch):
    outcome, wait, ended = await _walk(monkeypatch, _flow("ask"))
    assert [r.text for r in outcome.replies] == ["Boleh minta nomor pesanannya kak?"]
    assert outcome.handoff is False
    assert wait is None and ended


async def test_unwired_handoff_hands_over(monkeypatch):
    outcome, _wait, ended = await _walk(monkeypatch, _flow(None))
    assert outcome.handoff is True
    assert outcome.replies[0].text.startswith("Baik")
    assert ended
