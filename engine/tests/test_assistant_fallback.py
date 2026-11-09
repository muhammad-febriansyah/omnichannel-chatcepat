"""Assistant identity/business info, channel fallback actions, idle welcome trigger."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.ai.agent import AIResult
from app.ai.styles import AgentSpec, business_prompt, fill_placeholders, identity_prompt
from app.config import DEFAULT_FALLBACK_MESSAGE
from app.pipeline import decision
from app.repositories.flows import welcome_matches


def test_identity_and_business_info():
    spec = AgentSpec.from_dict(
        {
            "business_info": {
                "assistant_name": "Mila",
                "business_name": "Toko Mulia",
                "hours": "Senin–Sabtu 08.00–21.00",
                "address": "",
                "unknown_key": "ignored",
            }
        }
    )
    assert "Mila" in identity_prompt(spec) and "Toko Mulia" in identity_prompt(spec)
    info = business_prompt(spec)
    assert "Jam operasional: Senin–Sabtu 08.00–21.00" in info
    assert "Alamat" not in info and "ignored" not in info
    assert fill_placeholders("Kamu {{nama_asisten}} dari {{nama_bisnis}}.", spec) == "Kamu Mila dari Toko Mulia."
    # Bad data never breaks the prompt.
    assert AgentSpec.from_dict({"business_info": "x"}).business_info == {}
    assert identity_prompt(AgentSpec()) == "" and business_prompt(AgentSpec()) == ""


def test_welcome_idle_hours():
    assert welcome_matches({}, True, None)
    assert not welcome_matches({}, False, 50)
    assert welcome_matches({"idle_hours": 12}, False, 12.5)
    assert not welcome_matches({"idle_hours": 12}, False, 3)
    assert not welcome_matches({"idle_hours": "x"}, False, 99)


def _run(channel, monkeypatch, ai_result=None):
    async def no_flow(*args, **kwargs):
        return None

    async def fake_ai(*args, **kwargs):
        return ai_result

    monkeypatch.setattr(decision.flow_engine, "run", no_flow)
    monkeypatch.setattr(decision.ai, "try_ai", fake_ai)
    conv = SimpleNamespace(handler="bot")
    inbound = SimpleNamespace(comment=None, body="halo")
    return asyncio.run(decision.decide(None, conv, channel, None, inbound))


def _channel(**kw):
    return SimpleNamespace(auto_reply_enabled=True, default_flow_id=None, **kw)


def test_fallback_actions(monkeypatch):
    d = _run(_channel(fallback_action="silent", fallback_message=None), monkeypatch)
    assert d.stop and not d.replies

    d = _run(_channel(fallback_action="message", fallback_message="Halo, tunggu sebentar ya"), monkeypatch)
    assert [r.text for r in d.replies] == ["Halo, tunggu sebentar ya"]

    d = _run(_channel(fallback_action="message", fallback_message="  "), monkeypatch)
    assert [r.text for r in d.replies] == [DEFAULT_FALLBACK_MESSAGE]

    d = _run(_channel(fallback_action="ai", fallback_message=None), monkeypatch, AIResult(reply="Hai kak!"))
    assert [r.text for r in d.replies] == ["Hai kak!"] and not d.handoff

    # AI not configured → falls back to the fixed text instead of going silent.
    d = _run(_channel(fallback_action="ai", fallback_message="Pesan tetap"), monkeypatch, None)
    assert [r.text for r in d.replies] == ["Pesan tetap"]

    # Older rows without the column behave as before.
    d = _run(SimpleNamespace(auto_reply_enabled=True, default_flow_id=None), monkeypatch)
    assert [r.text for r in d.replies] == [DEFAULT_FALLBACK_MESSAGE]
