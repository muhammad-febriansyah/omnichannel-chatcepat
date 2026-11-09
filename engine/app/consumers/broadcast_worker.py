"""Broadcast worker (07). Poll broadcast running → dispatch (throttle); start scheduled
broadcasts (flow trigger "broadcast") once their time has come. Jalankan:
python -m app.consumers.broadcast_worker
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from ..db import AsyncSessionLocal
from ..repositories import broadcasts
from ..services.broadcast import dispatch, run_broadcast

log = logging.getLogger("engine.broadcast.worker")

POLL_INTERVAL_S = 5


async def start_due() -> int:
    """Scheduled → running (builds the opt-in audience at send time)."""
    async with AsyncSessionLocal() as session:
        due = await broadcasts.due_scheduled(session, datetime.now(timezone.utc))
    for b in due:
        try:
            await run_broadcast(b.id)
            log.info("broadcast terjadwal %s mulai", b.id)
        except ValueError as e:
            log.warning("broadcast terjadwal %s gagal: %s", b.id, e)
            async with AsyncSessionLocal() as session, session.begin():
                await broadcasts.mark_failed(session, b.id, str(e))
    return len(due)


async def tick() -> int:
    await start_due()
    async with AsyncSessionLocal() as session:
        running = await broadcasts.running_broadcasts(session)
    for b in running:
        log.info("dispatch broadcast %s", b.id)
        await dispatch(b.id)
    return len(running)


async def run() -> None:
    log.info("broadcast worker mulai")
    while True:
        try:
            await tick()
        except Exception:
            log.exception("broadcast worker tick gagal")
        await asyncio.sleep(POLL_INTERVAL_S)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()
