"""Broadcast as a flow trigger: replies / button taps continue the flow from the
broadcast step; the worker's text broadcast is personalised and may carry an image."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from app.contracts.events import Type1 as OutboundType
from app.pipeline import flow_engine
from app.services import broadcast as bsvc

TENANT = uuid.uuid4()
FLOW_ID = uuid.uuid4()
BCAST_ID = uuid.uuid4()

NODES = [
    {"id": "t", "type": "trigger", "trigger": {"kind": "broadcast", "channels": ["x"]}, "next": "m"},
    {
        "id": "m",
        "type": "broadcast_message",
        "text": "Promo!",
        "save_as": "balasan",
        "buttons": [{"index": 0, "text": "Mau", "next": "yes"}, {"index": 2, "text": "Nanti", "next": None}],
        "next": "other",
    },
    {"id": "yes", "type": "send_text", "text": "Siap {{nama}}, pilih {{tombol}}", "next": None},
    {"id": "other", "type": "send_text", "text": "Balasanmu: {{balasan}}", "next": None},
]


def _flow(status="active"):
    return SimpleNamespace(id=FLOW_ID, tenant_id=TENANT, status=status, definition={"nodes": NODES})


def _inbound(body: str, payload: str | None = None):
    return SimpleNamespace(
        body=body,
        payload=payload,
        type=SimpleNamespace(value="interactive" if payload else "text"),
        comment=None,
    )


def _patch(monkeypatch, *, state=None, flow=None):
    persisted = {}

    async def get_state(_s, _cid):
        return state

    async def delete_state(_s, _cid):
        persisted["deleted"] = True

    async def get_bcast(_s, bid, **_kw):
        return SimpleNamespace(id=bid, tenant_id=TENANT, flow_id=FLOW_ID, flow_node_id="m") if bid == BCAST_ID else None

    async def get_flow(_s, fid, tenant_id=None):
        return flow if flow is not None and fid == FLOW_ID else None

    async def persist(_s, _conv, _flow, wait, ctx):
        persisted["wait"] = wait
        persisted["ctx"] = ctx

    monkeypatch.setattr(flow_engine.states, "get", get_state)
    monkeypatch.setattr(flow_engine.states, "delete", delete_state)
    monkeypatch.setattr(flow_engine.broadcasts, "get", get_bcast)
    monkeypatch.setattr(flow_engine.flows, "get", get_flow)
    monkeypatch.setattr(flow_engine, "_persist_or_clear", persist)
    return persisted


CONV = SimpleNamespace(id=uuid.uuid4(), tenant_id=TENANT)
CONTACT = SimpleNamespace(name="Sari")


def test_broadcast_next_picks_button_branch():
    node = NODES[1]
    assert flow_engine.broadcast_next(node, 0) == "yes"
    assert flow_engine.broadcast_next(node, 2) == "other"  # unwired button → "Balasan lain"
    assert flow_engine.broadcast_next(node, 7) == "other"
    assert flow_engine.broadcast_next(node, None) == "other"


async def test_button_tap_continues_flow_even_without_state(monkeypatch):
    persisted = _patch(monkeypatch, state=None, flow=_flow())
    out = await flow_engine.run(None, CONV, None, CONTACT, _inbound("Mau", f"bc:{BCAST_ID}:0"))
    assert [r.text for r in out.replies] == ["Siap Sari, pilih Mau"]
    assert persisted["ctx"]["broadcast_id"] == str(BCAST_ID)


async def test_text_reply_resumes_from_broadcast_step(monkeypatch):
    from datetime import datetime, timedelta, timezone

    state = SimpleNamespace(
        flow_id=FLOW_ID,
        current_node_id="m",
        context={"nama": "Sari", "broadcast_id": str(BCAST_ID)},
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    persisted = _patch(monkeypatch, state=state, flow=_flow())
    out = await flow_engine.run(None, CONV, None, CONTACT, _inbound("boleh info dong"))
    assert [r.text for r in out.replies] == ["Balasanmu: boleh info dong"]
    assert persisted["ctx"]["balasan"] == "boleh info dong"


async def test_inactive_flow_falls_back_to_button_label_trigger(monkeypatch):
    persisted = _patch(monkeypatch, state=SimpleNamespace(flow_id=FLOW_ID), flow=_flow(status="draft"))

    async def no_flow(*_a, **_kw):
        return None

    async def one(*_a, **_kw):
        return 1

    monkeypatch.setattr(flow_engine.flows, "match_trigger", no_flow)
    monkeypatch.setattr(flow_engine.messages, "count_inbound", one)
    channel = SimpleNamespace(id=uuid.uuid4())
    out = await flow_engine.run(None, CONV, channel, CONTACT, _inbound("Mau", f"bc:{BCAST_ID}:0"))
    assert out is None
    assert persisted.get("deleted") is True  # old waiting state cleared like before


def test_text_broadcast_personalised_with_image():
    b = SimpleNamespace(
        id=BCAST_ID,
        channel_id=uuid.uuid4(),
        flow_id=FLOW_ID,
        template_id=None,
        template_lang=None,
        template_params={"media_url": "/uploads/t/broadcast/promo.jpg"},
        body_snapshot="Halo {{nama}}!",
    )
    contact = SimpleNamespace(name="", phone="62812", external_id=None)
    channel = SimpleNamespace(type="wa_unofficial")
    cmd = bsvc._build_command(b, channel, contact, uuid.uuid4(), "idem")
    assert cmd.type == OutboundType.media
    assert cmd.body == "Halo Kak!"
    assert cmd.media.url.endswith("/uploads/t/broadcast/promo.jpg") and cmd.media.url.startswith("http")

    # Old (non-flow) broadcasts keep their text untouched.
    b.flow_id = None
    b.template_params = {}
    cmd = bsvc._build_command(b, channel, contact, uuid.uuid4(), "idem")
    assert cmd.type == OutboundType.text and cmd.body == "Halo {{nama}}!"
