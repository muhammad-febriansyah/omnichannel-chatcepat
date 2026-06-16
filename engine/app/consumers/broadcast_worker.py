"""Broadcast worker (07). Poll broadcast running → dispatch (throttle). Jalankan:
python -m app.consumers.broadcast_worker
"""

from __future__ import annotations

import asyncio
import logging

from ..db import AsyncSessionLocal
from ..repositories import broadcasts
from ..services.broadcast import dispatch

log = logging.getLogger("engine.broadcast.worker")

POLL_INTERVAL_S = 5


async def tick() -> int:
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
