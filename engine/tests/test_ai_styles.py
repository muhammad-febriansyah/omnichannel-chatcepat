"""AI agent styles (migration 0022): tone templates, examples, extra handoff rules."""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from app.ai import agent
from app.ai.styles import TONE_GUIDE, AgentSpec, examples_prompt, style_prompt


def test_style_prompt_follows_agent_settings():
    spec = AgentSpec(role="promosi", tone="promosi", emoji="tanpa", greeting="bapak_ibu", language="en", goal="closing")
    out = style_prompt(spec)
    assert TONE_GUIDE["promosi"] in out
    assert "Jangan pakai emoji." in out
    assert "Bapak/Ibu" in out
    assert "Always reply in English." in out
    assert "Tujuan utama percakapan: closing" in out


def test_unknown_values_fall_back_to_defaults():
    out = style_prompt(AgentSpec(role="??", tone="??", emoji="??", length="??", greeting="??", language="??"))
    assert TONE_GUIDE["ramah"] in out
    assert "Customer Service" in out


def test_examples_are_capped_and_skip_empty_pairs():
    spec = AgentSpec(examples=[{"q": "harga?", "a": "Mulai 50rb kak"}, {"q": "", "a": "x"}] + [{"q": f"q{i}", "a": "a"} for i in range(10)])
    out = examples_prompt(spec)
    assert "Pelanggan: harga?\nKamu: Mulai 50rb kak" in out
    assert out.count("Pelanggan:") == 5
    assert examples_prompt(AgentSpec()) == ""


def test_extra_handoff_rules_are_listed():
    out = agent._guardrail("- Tanya soal franchise\nMinta nomor owner\n")
    assert "- Tanya soal franchise\n" in out
    assert "- Minta nomor owner\n" in out
    assert agent._guardrail() .count("Tanya soal franchise") == 0


def test_promo_context_lists_code_and_end_date():
    promo = SimpleNamespace(
        id=uuid.uuid4(), title="Diskon 20%", description="Semua kaos\n ukuran L", code="KAOS20",
        ends_at=datetime(2026, 11, 30, 16, 0, tzinfo=timezone.utc),
    )
    out = agent._promo_context([promo])
    assert out == "- Diskon 20%: Semua kaos ukuran L (kode: KAOS20) — berlaku s/d 30 Nov 2026"


def test_agent_spec_from_node_settings_drops_unknown_and_bad_ids():
    doc = uuid.uuid4()
    spec = AgentSpec.from_dict(
        {"tone": "promosi", "document_ids": [str(doc), "bukan-uuid"], "evil": "x", "goal": None, "examples": "bad"}
    )
    assert spec.tone == "promosi"
    assert spec.document_ids == [doc]
    assert spec.examples == []
    assert spec.goal is None
