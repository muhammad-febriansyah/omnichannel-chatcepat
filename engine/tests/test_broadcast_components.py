"""template_components — header media, variabel per kontak, payload tombol broadcast."""

import uuid
from types import SimpleNamespace

from app.repositories.broadcasts import parse_click_payload
from app.services.broadcast import template_components


def test_components_fill_header_body_and_buttons():
    bid = uuid.uuid4()
    contact = SimpleNamespace(name="Budi", phone="+628111")
    params = {
        "header": {"format": "IMAGE", "link": "https://cdn.example/poster.jpg"},
        "body": [{"source": "contact_name", "fallback": "Kak"}, {"source": "static", "value": "19 Nov"}],
        "buttons": [{"index": 0, "type": "QUICK_REPLY"}, {"index": 1, "type": "QUICK_REPLY"}],
    }
    comps = template_components(bid, params, contact)
    assert comps[0] == {
        "type": "header",
        "parameters": [{"type": "image", "image": {"link": "https://cdn.example/poster.jpg"}}],
    }
    assert [p["text"] for p in comps[1]["parameters"]] == ["Budi", "19 Nov"]
    assert comps[2]["sub_type"] == "quick_reply"
    assert comps[3]["parameters"][0]["payload"] == f"bc:{bid}:1"
    assert parse_click_payload(f"bc:{bid}:1") == (bid, 1)


def test_empty_values_use_fallback_and_no_params_means_no_components():
    contact = SimpleNamespace(name="", phone=None)
    comps = template_components(uuid.uuid4(), {"body": [{"source": "contact_name", "fallback": "Kak"}]}, contact)
    assert comps[0]["parameters"][0]["text"] == "Kak"
    assert template_components(uuid.uuid4(), {}, contact) == []
    assert parse_click_payload("opt_a") is None
    assert parse_click_payload("bc:bukan-uuid:0") is None
