"""Integration test broadcast (07). Butuh postgres(5433) + redis(6379).

Fokus: guard kepatuhan (hanya opted_in dikirim) + dispatch publish outbound.
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select

from app.bus import client
from app.config import STREAM_OUTBOUND
from app.db import AsyncSessionLocal, engine
from app.models import Broadcast, BroadcastRecipient, Channel, Contact, Tenant
from app.repositories import broadcasts as brepo
from app.services.broadcast import dispatch, run_broadcast


def ok(cond: bool, label: str) -> None:
    print(("PASS" if cond else "FAIL"), label)
    assert cond, label


async def main():
    async with AsyncSessionLocal() as s:
        async with s.begin():
            t = Tenant(name="T", slug=f"t-{uuid.uuid4().hex[:8]}")
            s.add(t)
            await s.flush()
            ch = Channel(tenant_id=t.id, type="wa_official", name="WA", status="connected")
            s.add(ch)
            await s.flush()

            def mk(name, phone, status, tags):
                return Contact(
                    tenant_id=t.id, name=name, phone=phone, external_id=phone,
                    opt_in_status=status, tags=tags,
                )

            c_in = mk("In", "+6281", "opted_in", ["vip"])
            c_out = mk("Out", "+6282", "opted_out", ["vip"])
            c_unk = mk("Unk", "+6283", "unknown", ["vip"])
            c_in_notag = mk("InNoTag", "+6284", "opted_in", ["reguler"])
            s.add_all([c_in, c_out, c_unk, c_in_notag])
            await s.flush()

            b = Broadcast(
                tenant_id=t.id, channel_id=ch.id, name="Promo",
                body_snapshot="Promo diskon!", status="draft",
                audience_filter={"tags": ["vip"]},
            )
            s.add(b)
            await s.flush()
            bid, tid = b.id, t.id
            cid_in, cid_out = c_in.id, c_out.id

    # RUN: bangun recipients
    res = await run_broadcast(bid)
    ok(res["pending"] == 1, f"hanya 1 opted_in jadi pending (got {res['pending']})")
    ok(res["skipped_optout"] == 1, f"1 opted_out → skipped (got {res['skipped_optout']})")

    async with AsyncSessionLocal() as s:
        recips = (
            await s.scalars(select(BroadcastRecipient).where(BroadcastRecipient.broadcast_id == bid))
        ).all()
    by_contact = {r.contact_id: r.status for r in recips}
    ok(by_contact.get(cid_in) == "pending", "opted_in pending")
    ok(by_contact.get(cid_out) == "skipped_optout", "opted_out skipped_optout")
    ok(len(recips) == 2, "unknown & non-vip TIDAK jadi recipient")

    # DISPATCH (throttle 0)
    out = await dispatch(bid, throttle_s=0)
    ok(out["sent"] == 1, f"1 terkirim (got {out['sent']})")

    # Outbound stream: ada utk opted_in, TIDAK ada utk opted_out (compliance)
    stream = await client().xrange(STREAM_OUTBOUND, count=200)
    keys = [f["data"] for _id, f in stream]
    in_sent = any(f"bcast:{bid}:{cid_in}" in d for d in keys)
    out_sent = any(f"bcast:{bid}:{cid_out}" in d for d in keys)
    ok(in_sent, "OutboundCommand terbit utk opted_in")
    ok(not out_sent, "TIDAK ada outbound utk opted_out (guard data-level)")

    # Status + recipient
    async with AsyncSessionLocal() as s:
        b2 = await brepo.get(s, bid)
        r_in = (
            await s.scalars(
                select(BroadcastRecipient).where(
                    BroadcastRecipient.broadcast_id == bid,
                    BroadcastRecipient.contact_id == cid_in,
                )
            )
        ).one()
    ok(b2.status == "done", "broadcast status done")
    ok(b2.stats.get("sent") == 1, "stats.sent == 1")
    ok(r_in.status == "sent" and r_in.message_id is not None, "recipient sent + message_id terisi")

    await engine.dispose()
    print("\nALL PASS")


if __name__ == "__main__":
    asyncio.run(main())
