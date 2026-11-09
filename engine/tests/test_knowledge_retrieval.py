"""Knowledge tahap 3: hybrid retrieval fusion, follow-up queries, section chunks."""

import uuid

from app.ai.agent import retrieval_query
from app.ai.ingest import chunk_sections
from app.ai.rag import MAX_VECTOR_DISTANCE, fuse


def test_fuse_prefers_chunks_found_by_both_and_drops_far_vectors():
    a, b, c, d = (uuid.uuid4() for _ in range(4))
    vec = [(a, 0.20), (b, 0.35), (c, 0.90)]  # c is far away
    kw = [(b, 3), (d, 1)]
    ids = fuse(vec, kw, k=5)
    assert ids[0] == b  # both signals agree
    assert c not in ids  # too far and no keyword match → not given to the AI
    assert set(ids) == {a, b, d}


def test_far_vector_hit_survives_when_keywords_agree():
    a = uuid.uuid4()
    assert fuse([(a, MAX_VECTOR_DISTANCE + 0.2)], [(a, 2)], k=3) == [a]


def test_fuse_keyword_only_and_empty():
    a, b = uuid.uuid4(), uuid.uuid4()
    assert fuse([], [(a, 2), (b, 1)], k=1) == [a]
    assert fuse([], [], k=5) == []


def test_follow_up_is_searched_with_previous_question():
    history = [
        {"role": "user", "content": "jam buka toko berapa?"},
        {"role": "assistant", "content": "Senin–Sabtu 08.00–16.00 kak"},
    ]
    q = retrieval_query("kalau minggu?", history)
    assert "jam buka" in q and q.endswith("kalau minggu?")
    # A full question stands on its own.
    full = "ongkir pengiriman ke bandung berapa hari"
    assert retrieval_query(full, history) == full
    assert retrieval_query("halo", []) == "halo"


def test_chunks_follow_headings_and_carry_their_section():
    doc = "## Pengiriman\nKirim tiap hari kerja.\nPakai JNE.\n\n## Retur\nTukar ukuran 7 hari.\n\nJAM BUKA\nSenin-Sabtu 08-16"
    chunks = chunk_sections(doc, "Kebijakan")
    assert chunks == [
        "[Kebijakan › Pengiriman]\nKirim tiap hari kerja. Pakai JNE.",
        "[Kebijakan › Retur]\nTukar ukuran 7 hari.",
        "[Kebijakan › Jam Buka]\nSenin-Sabtu 08-16",
    ]


def test_long_text_is_split_on_sentences_within_size():
    sentence = "Produk kami dikirim dengan bubble wrap tebal supaya aman sampai tujuan. "
    chunks = chunk_sections(sentence * 40, "Info", size=400)
    assert len(chunks) > 1
    assert all(len(c) <= 400 for c in chunks)
    assert all(c.startswith("[Info]\n") for c in chunks)
    assert all(c.rstrip().endswith(".") for c in chunks)  # no sentence cut in half
