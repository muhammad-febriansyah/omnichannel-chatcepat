"""Consumer message.status (group 'engine'). Update status pesan + realtime (05).
Jalankan: python -m app.consumers.status_consumer."""

from __future__ import annotations

import asyncio
import logging
import os

from ..bus import close
from ..config import STREAM_STATUS
from ..contracts.events import MessageStatus
from ..services.status import apply_status_event
from .stream_runner import run_stream

log = logging.getLogger("engine.consumer.status")


async def _handle(data: str) -> None:
    await apply_status_event(MessageStatus.model_validate_json(data))


async def run(consumer_name: str | None = None) -> None:
    consumer_name = consumer_name or os.environ.get("CONSUMER_NAME", "engine-status-1")
    log.info("status consumer '%s' mulai", consumer_name)
    try:
        await run_stream(STREAM_STATUS, consumer_name, _handle, log)
    finally:
        await close()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()
