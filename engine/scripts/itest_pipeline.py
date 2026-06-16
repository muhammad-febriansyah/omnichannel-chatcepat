"""Integration test decision pipeline (manual). Butuh postgres(5433) + redis(6379).

Jalankan: DATABASE_URL=... REDIS_URL=... .venv/bin/python scripts/itest_pipeline.py
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.bus import client
from app.config import REALTIME_PREFIX, STREAM_OUTBOUND
from app.contracts.events import ChannelType, InboundMessage, Party, Type
from app.db import AsyncSessionLocal, engine
from app.models import Channel, Conversation, Message, Tenant
from app.services.inbound import handle


def ok(cond: bool, label: str) -> None:
    print(("PASS" if cond else "FAIL"), label)
    assert cond, label


async def main() -> None:
    # --- seed tenant + channel wa_official ---
    async with AsyncSessionLocal() as s, s.begin():
        t = Tenant(name="Demo", slug=f"demo-{uuid.uuid4().hex[:8]}")
        s.add(t)
        await s.flush()
        ch = Channel(
            tenant_id=t.id,
            type="wa_official",
            name="WA Demo",
            status="connected",
            external_id="pn-1",
        )
        s.add(ch)
        await s.flush()
        tid, cid = t.id, ch.id

    pubsub = client().pubsub()
    await pubsub.subscribe(f"{REALTIME_PREFIX}{tid}")

    inbound = InboundMessage(
        **{
            "event_id": uuid.uuid4().hex,
            "dedup_key": f"{cid}:wamid.TEST1",
            "channel_id": cid,
            "channel_type": ChannelType.wa_official,
            "from": Party(external_id="628123", phone="+628123", name="Budi"),
            "type": Type.text,
            "body": "halo mau pesan",
            "provider_message_id": "wamid.TEST1",
            "timestamp": datetime.now(timezone.utc),
        }
    )

    await handle(inbound)

    # --- assert DB ---
    async with AsyncSessionLocal() as s:
        msg_count = await s.scalar(
            select(func.count()).select_from(Message).where(Message.tenant_id == tid)
        )
        conv = await s.scalar(
            select(Conversation).where(Conversation.tenant_id == tid)
        )
        dirs = (
            await s.execute(
                select(Message.direction, Message.sender).where(Message.tenant_id == tid)
            )
        ).all()
    print("messages:", msg_count, "dirs:", dirs)
    ok(msg_count == 2, "2 message tersimpan (inbound + bot reply)")
    ok(("inbound", "contact") in dirs, "inbound dari contact")
    ok(("outbound", "bot") in dirs, "outbound dari bot")
    ok(conv.unread_count == 1, "unread_count == 1")
    ok(conv.last_message_preview is not None, "preview terisi")
    ok(conv.service_window_expires_at is not None, "service window wa_official di-set")

    # --- outbound stream ---
    out = await client().xrange(STREAM_OUTBOUND, count=50)
    mine = [f for _id, f in out if f"{cid}" in f["data"] and "wamid.TEST1" in f["data"]]
    ok(len(mine) == 1, "1 OutboundCommand dipublish ke message.outbound")
    print("outbound sample:", mine[0]["data"][:160])

    # --- dedup replay ---
    await handle(inbound)
    async with AsyncSessionLocal() as s:
        msg_count2 = await s.scalar(
            select(func.count()).select_from(Message).where(Message.tenant_id == tid)
        )
    ok(msg_count2 == 2, "replay dedup: tidak ada message baru")

    # --- realtime ---
    seen = 0
    for _ in range(6):
        m = await pubsub.get_message(timeout=1.0)
        if m and m.get("type") == "message":
            seen += 1
    ok(seen >= 2, f"realtime message.new terbit (lihat {seen})")

    await pubsub.aclose()
    await engine.dispose()
    print("\nALL PASS")


if __name__ == "__main__":
    asyncio.run(main())
