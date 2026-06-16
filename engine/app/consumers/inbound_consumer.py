"""Consumer message.inbound (group 'engine'). Jalankan: python -m app.consumers.inbound_consumer."""

from __future__ import annotations

import asyncio
import logging
import os

from ..bus import ack, close, ensure_group, read_group
from ..config import STREAM_INBOUND
from ..contracts.events import InboundMessage
from ..services.inbound import handle

log = logging.getLogger("engine.consumer.inbound")


async def run(consumer_name: str | None = None) -> None:
    consumer_name = consumer_name or os.environ.get("CONSUMER_NAME", "engine-1")
    await ensure_group(STREAM_INBOUND)
    log.info("inbound consumer '%s' mulai", consumer_name)
    try:
        while True:
            batch = await read_group(STREAM_INBOUND, consumer_name)
            for msg_id, fields in batch:
                try:
                    inbound = InboundMessage.model_validate_json(fields["data"])
                    await handle(inbound)
                except Exception:
                    # Pesan tak boleh hilang (05). Ack supaya tak jadi poison loop.
                    # TODO: dead-letter stream + retry backoff.
                    log.exception("gagal proses inbound %s", msg_id)
                await ack(STREAM_INBOUND, msg_id)
    finally:
        await close()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()
