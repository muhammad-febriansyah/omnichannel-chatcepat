"""Consumer message.inbound (group 'engine'). Jalankan: python -m app.consumers.inbound_consumer."""

from __future__ import annotations

import asyncio
import logging
import os

from ..bus import close
from ..config import STREAM_INBOUND
from ..contracts.events import InboundMessage
from ..services.inbound import handle
from .stream_runner import run_stream

log = logging.getLogger("engine.consumer.inbound")


async def _handle(data: str) -> None:
    await handle(InboundMessage.model_validate_json(data))


async def run(consumer_name: str | None = None) -> None:
    consumer_name = consumer_name or os.environ.get("CONSUMER_NAME", "engine-1")
    log.info("inbound consumer '%s' mulai", consumer_name)
    try:
        await run_stream(STREAM_INBOUND, consumer_name, _handle, log)
    finally:
        await close()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()
