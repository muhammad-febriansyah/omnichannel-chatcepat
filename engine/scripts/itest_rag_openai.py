"""RAG real pakai OpenAI (embedding + chat). Butuh postgres(5433) + LLM_PROVIDER=openai.

Jalankan: set -a; . ../.env; set +a; DATABASE_URL=...5433 .venv/bin/python scripts/itest_rag_openai.py
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from app.ai import rag
from app.ai.ingest import ingest
from app.ai.llm import get_provider
from app.contracts.events import ChannelType, InboundMessage, Party, Type
from app.db import AsyncSessionLocal, engine
from app.models import Channel, Contact, Conversation, KnowledgeDocument, Tenant
from app.pipeline.decision import decide

KB = (
    "Produk unggulan kami Sepatu Lari Velox. Harga Rp 500.000. "
    "Garansi resmi 1 tahun. Tersedia ukuran 39 sampai 44. "
    "Pengiriman gratis untuk wilayah Jabodetabek."
)


def ok(c: bool, label: str) -> None:
    print(("PASS" if c else "FAIL"), label)
    assert c, label


async def main():
    p = get_provider()
    ok(type(p).__name__ == "OpenAIProvider", "provider OpenAI aktif")

    async with AsyncSessionLocal() as s:
        async with s.begin():
            t = Tenant(name="T", slug=f"t-{uuid.uuid4().hex[:8]}")
            s.add(t); await s.flush()
            ch = Channel(tenant_id=t.id, type="wa_official", name="WA", status="connected")
            s.add(ch); await s.flush()
            ct = Contact(tenant_id=t.id, external_id="628", phone="+628", name="Budi", opt_in_status="opted_in")
            s.add(ct); await s.flush()
            conv = Conversation(tenant_id=t.id, channel_id=ch.id, contact_id=ct.id, status="open", handler="bot")
            s.add(conv); await s.flush()
            doc = KnowledgeDocument(tenant_id=t.id, source_type="manual", title="Produk", status="processing")
            s.add(doc); await s.flush()
            doc_id, tid = doc.id, t.id

        # Ingest (chunk + embed real OpenAI)
        async with s.begin():
            n = await ingest(s, doc_id, KB)
        ok(n >= 1, f"ingest {n} chunk")

        # Retrieve
        qvec = await p.embed("berapa harga sepatu lari?")
        async with s.begin():
            chunks = await rag.retrieve(s, tid, qvec, 2)
        joined = " ".join(c.content for c in chunks)
        ok("500" in joined, "RAG ambil info harga (500)")

        # AI grounded via decide
        inbound = InboundMessage(
            **{
                "event_id": uuid.uuid4().hex, "dedup_key": f"{ch.id}:x",
                "channel_id": ch.id, "channel_type": ChannelType.wa_official,
                "from": Party(external_id="628", phone="+628", name="Budi"),
                "type": Type.text, "body": "Sepatu Velox harganya berapa dan ada garansi?",
                "provider_message_id": uuid.uuid4().hex, "timestamp": datetime.now(timezone.utc),
            }
        )
        async with s.begin():
            d = await decide(s, conv, ch, ct, inbound)
        ans = d.replies[0] if d.replies else ""
        print("AI:", ans[:160])
        ok("500" in ans or "garansi" in ans.lower(), "jawaban AI grounded ke KB")

    await engine.dispose()
    print("\nALL PASS")


if __name__ == "__main__":
    asyncio.run(main())
