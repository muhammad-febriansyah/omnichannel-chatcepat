"""Integration test modul 06 (flow + AI + RAG). Butuh postgres(5433).

Jalankan: DATABASE_URL=postgresql+asyncpg://...@127.0.0.1:5433/... .venv/bin/python scripts/itest_06.py
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from app.ai import rag
from app.ai.llm import EchoProvider, reset_provider, set_provider
from app.contracts.events import ChannelType, InboundMessage, Party, Type
from app.db import AsyncSessionLocal, engine
from app.models import Channel, Contact, Conversation, Flow, KnowledgeChunk, KnowledgeDocument, Tenant
from app.pipeline.decision import decide

FLOW_DEF = {
    "nodes": [
        {"id": "start", "type": "trigger", "trigger": {"kind": "keyword", "match": ["menu", "mulai"]}, "next": "greet"},
        {"id": "greet", "type": "send_text", "text": "Halo {{nama}} pilih:\n1. Katalog\n2. Promo", "next": "wait_menu"},
        {"id": "wait_menu", "type": "wait_reply", "save_as": "menu", "next": "branch_menu"},
        {"id": "branch_menu", "type": "condition",
         "branches": [{"if": "menu == '1'", "next": "send_katalog"}, {"if": "menu == '2'", "next": "send_promo"}],
         "else": "send_promo"},
        {"id": "send_katalog", "type": "send_text", "text": "Ini katalog kami.", "next": "handoff"},
        {"id": "send_promo", "type": "send_text", "text": "Promo diskon 20%.", "next": None},
        {"id": "handoff", "type": "handoff", "to": "agent"},
    ]
}


def ok(cond: bool, label: str) -> None:
    print(("PASS" if cond else "FAIL"), label)
    assert cond, label


def inbound(cid, body: str) -> InboundMessage:
    return InboundMessage(
        **{
            "event_id": uuid.uuid4().hex,
            "dedup_key": f"{cid}:{uuid.uuid4().hex}",
            "channel_id": cid,
            "channel_type": ChannelType.wa_official,
            "from": Party(external_id="628", phone="+628", name="Budi"),
            "type": Type.text,
            "body": body,
            "provider_message_id": uuid.uuid4().hex,
            "timestamp": datetime.now(timezone.utc),
        }
    )


async def seed(session, *, with_flow: bool):
    t = Tenant(name="T", slug=f"t-{uuid.uuid4().hex[:8]}")
    session.add(t)
    await session.flush()
    ch = Channel(tenant_id=t.id, type="wa_official", name="WA", status="connected")
    session.add(ch)
    await session.flush()
    ct = Contact(tenant_id=t.id, external_id="628", phone="+628", name="Budi", opt_in_status="opted_in")
    session.add(ct)
    await session.flush()
    conv = Conversation(tenant_id=t.id, channel_id=ch.id, contact_id=ct.id, status="open", handler="bot")
    session.add(conv)
    await session.flush()
    if with_flow:
        f = Flow(tenant_id=t.id, name="Menu", status="active", trigger="keyword", definition=FLOW_DEF)
        session.add(f)
        await session.flush()
    return t, ch, ct, conv


async def test_flow():
    print("\n== FLOW ==")
    reset_provider()  # AI nonaktif → flow murni
    async with AsyncSessionLocal() as s:
        async with s.begin():
            t, ch, ct, conv = await seed(s, with_flow=True)
        # pesan 1: trigger "menu"
        async with s.begin():
            d1 = await decide(s, conv, ch, ct, inbound(ch.id, "menu"))
        ok(len(d1.replies) == 1 and d1.replies[0].startswith("Halo Budi"), "flow greet ter-render")
        ok(not d1.handoff and not d1.stop, "belum handoff (nunggu balasan)")
        # pesan 2: pilih "1" → katalog + handoff
        async with s.begin():
            d2 = await decide(s, conv, ch, ct, inbound(ch.id, "1"))
        ok(d2.replies == ["Ini katalog kami."], "resume → katalog")
        ok(d2.handoff, "handoff setelah katalog")


async def test_ai_and_rag():
    print("\n== AI + RAG ==")
    set_provider(EchoProvider())
    provider = EchoProvider()
    async with AsyncSessionLocal() as s:
        async with s.begin():
            t, ch, ct, conv = await seed(s, with_flow=False)
            doc = KnowledgeDocument(tenant_id=t.id, source_type="manual", title="KB", status="ready")
            s.add(doc)
            await s.flush()
            c1 = KnowledgeChunk(tenant_id=t.id, document_id=doc.id, content="Promo diskon 20% untuk sepatu.",
                                embedding=await provider.embed("Promo diskon 20% untuk sepatu."))
            c2 = KnowledgeChunk(tenant_id=t.id, document_id=doc.id, content="Jam buka toko 9 pagi.",
                                embedding=await provider.embed("Jam buka toko 9 pagi."))
            s.add_all([c1, c2])
            await s.flush()
            tid = t.id

        # RAG retrieve langsung
        qvec = await provider.embed("promo diskon")
        async with s.begin():
            chunks = await rag.retrieve(s, tid, qvec, 1)
        ok(len(chunks) == 1 and "Promo" in chunks[0].content, "RAG ambil chunk terdekat (promo)")

        # AI via decide (no flow → AI aktif)
        async with s.begin():
            d = await decide(s, conv, ch, ct, inbound(ch.id, "ada promo diskon?"))
        ok(len(d.replies) == 1 and d.replies[0].startswith("(echo)"), "AI agent menjawab")


async def test_ai_disabled_fallback():
    print("\n== AI DISABLED → FALLBACK ==")
    set_provider(None)
    async with AsyncSessionLocal() as s:
        async with s.begin():
            t, ch, ct, conv = await seed(s, with_flow=False)
        async with s.begin():
            d = await decide(s, conv, ch, ct, inbound(ch.id, "halo"))
        ok(len(d.replies) == 1 and "agen" in d.replies[0].lower(), "fallback default kalau AI off & no flow")


async def main():
    await test_flow()
    await test_ai_and_rag()
    await test_ai_disabled_fallback()
    await engine.dispose()
    print("\nALL PASS")


if __name__ == "__main__":
    asyncio.run(main())
