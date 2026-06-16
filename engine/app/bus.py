"""Redis Streams (consumer group + ack) + Pub/Sub realtime.

Pesan stream disimpan di field `data` berisi JSON. Lihat docs/prd/01, 09.
"""

from __future__ import annotations

import redis.asyncio as redis
from redis.exceptions import ResponseError

from .config import (
    CONSUMER_GROUP,
    REALTIME_PREFIX,
    REDIS_URL,
    STREAM_OUTBOUND,
    STREAM_STATUS,
)

_client: redis.Redis | None = None


def client() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(REDIS_URL, decode_responses=True)
    return _client


async def ensure_group(stream: str, group: str = CONSUMER_GROUP) -> None:
    """Buat consumer group (idempoten — abaikan BUSYGROUP)."""
    try:
        await client().xgroup_create(stream, group, id="0", mkstream=True)
    except ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


async def read_group(
    stream: str,
    consumer: str,
    group: str = CONSUMER_GROUP,
    count: int = 10,
    block_ms: int = 5000,
) -> list[tuple[str, dict[str, str]]]:
    """Baca pesan baru untuk consumer. Return list (message_id, fields)."""
    resp = await client().xreadgroup(
        group, consumer, {stream: ">"}, count=count, block=block_ms
    )
    out: list[tuple[str, dict[str, str]]] = []
    for _stream, messages in resp or []:
        for msg_id, fields in messages:
            out.append((msg_id, fields))
    return out


async def ack(stream: str, msg_id: str, group: str = CONSUMER_GROUP) -> None:
    await client().xack(stream, group, msg_id)


async def publish(stream: str, payload: str) -> str:
    return await client().xadd(stream, {"data": payload})


async def publish_outbound(payload_json: str) -> str:
    return await publish(STREAM_OUTBOUND, payload_json)


async def publish_status(payload_json: str) -> str:
    return await publish(STREAM_STATUS, payload_json)


async def publish_realtime(tenant_id: str, payload_json: str) -> int:
    """Fire-and-forget realtime ke channel per tenant."""
    return await client().publish(f"{REALTIME_PREFIX}{tenant_id}", payload_json)


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
