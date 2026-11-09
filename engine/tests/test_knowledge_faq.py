"""Knowledge tahap 1: FAQ priority, unanswered-question log, marker handling."""

from types import SimpleNamespace

from app.ai.agent import _guardrail, strip_unknown_marker
from app.repositories.knowledge_faq import FAQ_ALL_BELOW, normalize_question, rank_faqs


def _faq(q, a):
    return SimpleNamespace(question=q, answer=a)


def test_normalize_question_groups_same_question():
    assert normalize_question("Bisa COD, kak??") == normalize_question("bisa   cod kak")
    assert normalize_question("  Ongkir ke Bandung? ") == "ongkir ke bandung"


def test_small_faq_list_goes_to_ai_whole():
    faqs = [_faq(f"Q{i}", f"A{i}") for i in range(FAQ_ALL_BELOW)]
    assert rank_faqs(faqs, "apa saja") == faqs


def test_big_faq_list_is_filtered_by_question():
    faqs = [_faq(f"Pertanyaan lain {i}", "jawaban umum") for i in range(30)]
    faqs.append(_faq("Bisa bayar COD?", "Bisa, COD area Jakarta"))
    faqs.append(_faq("Jam buka toko?", "Senin–Sabtu 08.00–16.00"))
    top = rank_faqs(faqs, "kak bisa cod ga ke jakarta?")
    assert top and top[0].question == "Bisa bayar COD?"
    assert all("lain" not in f.question for f in top)
    assert rank_faqs(faqs, "zzz qqq") == []


def test_unknown_marker_is_stripped_and_flagged():
    text, unknown = strip_unknown_marker("Saya cek dulu ya kak 🙏 [[CEK]]")
    assert unknown and text == "Saya cek dulu ya kak 🙏"
    text, unknown = strip_unknown_marker("Ada kak, harganya Rp50.000")
    assert not unknown and text == "Ada kak, harganya Rp50.000"


def test_guardrail_asks_for_marker_only_for_business_questions():
    g = _guardrail(None)
    assert "[[CEK]]" in g and "di luar bisnis" in g
