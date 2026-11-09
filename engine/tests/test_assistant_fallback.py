"""Assistant identity/business info, channel fallback actions, idle welcome trigger."""

from __future__ import annotations

import asyncio
import uuid
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


def _run(channel, monkeypatch, ai_result=None, already_sent=False):
    async def no_flow(*args, **kwargs):
        return None

    async def sent_before(*args, **kwargs):
        return already_sent

    async def fake_ai(*args, **kwargs):
        return ai_result

    monkeypatch.setattr(decision.flow_engine, "run", no_flow)
    monkeypatch.setattr(decision.ai, "try_ai", fake_ai)
    monkeypatch.setattr(decision.messages, "bot_sent_text_since", sent_before)
    conv = SimpleNamespace(handler="bot", id=uuid.uuid4())
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


def test_fixed_fallback_is_not_repeated(monkeypatch):
    """The same "pesan tetap" on every message looks like spam and burns the WA cap."""
    ch = _channel(fallback_action="message", fallback_message="Tunggu ya kak")
    assert [r.text for r in _run(ch, monkeypatch).replies] == ["Tunggu ya kak"]
    d = _run(ch, monkeypatch, already_sent=True)
    assert d.stop and not d.replies
    # AI answers are not deduplicated (each question gets its own answer).
    ai_ch = _channel(fallback_action="ai", fallback_message=None)
    d = _run(ai_ch, monkeypatch, AIResult(reply="Ada kak"), already_sent=True)
    assert [r.text for r in d.replies] == ["Ada kak"]


def test_agent_reply_to_active_chat_skips_warmup_cap(monkeypatch):
    from datetime import datetime, timedelta, timezone

    from app.services import warmup

    channel = SimpleNamespace(type="wa_unofficial", id=uuid.uuid4(), created_at=datetime.now(timezone.utc))

    async def used_up(*args, **kwargs):
        return 0

    monkeypatch.setattr(warmup, "remaining", used_up)

    async def last_in(minutes):
        async def f(*args, **kwargs):
            return datetime.now(timezone.utc) - timedelta(minutes=minutes) if minutes is not None else None
        return f

    # Contact wrote 5 minutes ago → CS can always answer.
    monkeypatch.setattr(warmup.messages, "last_inbound_at", asyncio.run(last_in(5)))
    asyncio.run(warmup.enforce_unofficial(None, channel, conversation_id=uuid.uuid4()))

    # Quiet for 2 days, or a brand-new chat → cap applies.
    import pytest

    monkeypatch.setattr(warmup.messages, "last_inbound_at", asyncio.run(last_in(60 * 48)))
    with pytest.raises(warmup.DailyCapReached):
        asyncio.run(warmup.enforce_unofficial(None, channel, conversation_id=uuid.uuid4()))
    with pytest.raises(warmup.DailyCapReached):
        asyncio.run(warmup.enforce_unofficial(None, channel))


def test_bot_resumes_after_agent_goes_quiet(monkeypatch):
    """Agent took over then stopped replying → the bot answers again; a fresh agent
    reply or an unanswered handoff keeps the bot quiet."""
    from datetime import datetime, timedelta, timezone

    async def no_flow(*args, **kwargs):
        return None

    async def not_sent(*args, **kwargs):
        return False

    monkeypatch.setattr(decision.flow_engine, "run", no_flow)
    monkeypatch.setattr(decision.messages, "bot_sent_text_since", not_sent)

    def run(last):
        async def last_out(*args, **kwargs):
            return last

        monkeypatch.setattr(decision.messages, "last_outbound", last_out)
        conv = SimpleNamespace(handler="agent", id=uuid.uuid4())
        d = asyncio.run(decision.decide(None, conv, _channel(fallback_action="message", fallback_message="Hai"), None, SimpleNamespace(comment=None, body="halo")))
        return conv, d

    now = datetime.now(timezone.utc)
    conv, d = run(("agent", now - timedelta(hours=decision.BOT_RESUME_HOURS + 1)))
    assert conv.handler == "bot" and [r.text for r in d.replies] == ["Hai"]

    conv, d = run(("agent", now - timedelta(minutes=10)))
    assert conv.handler == "agent" and d.stop

    conv, d = run(("bot", now - timedelta(days=2)))  # handoff, agent never answered
    assert conv.handler == "agent" and d.stop

    conv, d = run(None)  # "Ambil alih" without a message yet
    assert conv.handler == "agent" and d.stop


def test_backlog_messages_are_not_auto_answered():
    """Offline backlog after a reconnect (hours old) stays in the inbox, unanswered."""
    from datetime import datetime, timedelta, timezone

    from app.services import inbound as inbound_svc

    now = datetime.now(timezone.utc)
    assert inbound_svc._is_stale(SimpleNamespace(timestamp=now - timedelta(hours=2)))
    assert not inbound_svc._is_stale(SimpleNamespace(timestamp=now - timedelta(seconds=30)))
    assert not inbound_svc._is_stale(SimpleNamespace(timestamp=None))


def test_guardrail_keeps_ai_on_topic():
    """The AI must not claim products outside the business or answer unrelated topics."""
    from app.ai.agent import _guardrail

    g = _guardrail(None)
    assert "Lingkup (WAJIB)" in g
    assert "jual oli" in g  # concrete example of an out-of-scope product
    assert "JANGAN" in g and "tersedia" in g
    assert "Jangan menjawab isinya" in g  # unrelated general questions are declined
