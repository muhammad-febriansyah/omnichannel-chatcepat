"""Consumer message.status (group 'engine'). Update status pesan + realtime (05).
Jalankan: python -m app.consumers.status_consumer."""

from __future__ import annotations

import asyncio
import logging
import os

from redis.exceptions import (
    ConnectionError as RedisConnectionError,
    TimeoutError as RedisTimeoutError,
)

from ..bus import ack, close, ensure_group, read_group
from ..config import STREAM_STATUS
from ..contracts.events import MessageStatus
from ..services.status import apply_status_event

log = logging.getLogger("engine.consumer.status")


async def run(consumer_name: str | None = None) -> None:
    consumer_name = consumer_name or os.environ.get("CONSUMER_NAME", "engine-status-1")
    await ensure_group(STREAM_STATUS)
    log.info("status consumer '%s' mulai", consumer_name)
    try:
        while True:
            try:
                batch = await read_group(STREAM_STATUS, consumer_name)
            except (RedisTimeoutError, RedisConnectionError):
                continue
            except Exception:
                log.exception("read_group gagal, retry")
                await asyncio.sleep(1)
                continue
            for msg_id, fields in batch:
                try:
                    st = MessageStatus.model_validate_json(fields["data"])
                    await apply_status_event(st)
                except Exception:
                    log.exception("gagal proses status %s", msg_id)
                await ack(STREAM_STATUS, msg_id)
    finally:
        await close()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()
