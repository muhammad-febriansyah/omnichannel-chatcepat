"""Shared loop for engine stream consumers: read, process, ack.

A message is acked only once it is processed, or when it can never be (bad payload,
a bug in processing). When the database or Redis is briefly unreachable the message
is retried with backoff and, if it still fails, left un-acked so the next start of
this consumer picks it up again. Inbound messages must not be lost (docs/prd/05).
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from redis.exceptions import (
    ConnectionError as RedisConnectionError,
    TimeoutError as RedisTimeoutError,
)
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError

from ..bus import ack, ensure_group, read_group

# Backoff between attempts on a transient error: 1, 2, 4, 8, 16, 30, 30 s (~1.5 min).
RETRY_DELAYS = (1, 2, 4, 8, 16, 30, 30)


def is_transient(exc: BaseException) -> bool:
    """Errors that mean "try again later", not "this message is broken"."""
    if isinstance(exc, (OperationalError, InterfaceError)):
        return True
    if isinstance(exc, DBAPIError) and exc.connection_invalidated:
        return True
    return isinstance(
        exc,
        (RedisConnectionError, RedisTimeoutError, ConnectionError, OSError, asyncio.TimeoutError),
    )


async def _process(
    stream: str,
    msg_id: str,
    fields: dict[str, str],
    handle: Callable[[str], Awaitable[None]],
    log: logging.Logger,
    sleep: Callable[[float], Awaitable[None]],
) -> None:
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            await handle(fields["data"])
        except Exception as exc:
            if not is_transient(exc):
                # Retrying will not help; ack so it does not block the stream forever.
                log.exception("gagal proses %s %s, dilewati", stream, msg_id)
                break
            if attempt == len(RETRY_DELAYS):
                # Still failing: leave it pending, the next start retries it.
                log.error("gagal proses %s %s (gangguan sementara), disimpan untuk diulang", stream, msg_id)
                return
            log.warning("gangguan sementara proses %s %s, ulangi: %s", stream, msg_id, exc)
            await sleep(RETRY_DELAYS[attempt])
            continue
        break
    await ack(stream, msg_id)


async def run_stream(
    stream: str,
    consumer: str,
    handle: Callable[[str], Awaitable[None]],
    log: logging.Logger,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> None:
    await ensure_group(stream)

    # First the messages this consumer read before but never acked (crash, or
    # given up during an outage), then new ones.
    cursor = "0"
    while True:
        try:
            pending = await read_group(stream, consumer, start_id=cursor, block_ms=None)
        except Exception:
            log.exception("baca pending %s gagal, retry", stream)
            await sleep(1)
            continue
        if not pending:
            break
        for msg_id, fields in pending:
            await _process(stream, msg_id, fields, handle, log, sleep)
            cursor = msg_id

    while True:
        try:
            batch = await read_group(stream, consumer)
        except (RedisTimeoutError, RedisConnectionError):
            # Idle block or a network blip: normal, read again.
            continue
        except Exception:
            log.exception("read_group %s gagal, retry", stream)
            await sleep(1)
            continue
        for msg_id, fields in batch:
            await _process(stream, msg_id, fields, handle, log, sleep)
