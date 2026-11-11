"""Stream consumers must not drop a message because the database blinked."""

import logging

import pytest
from sqlalchemy.exc import OperationalError

from app.consumers import stream_runner


class Stop(BaseException):
    # BaseException: the runner retries on Exception, this must escape its loop.
    pass


@pytest.fixture
def fake_stream(monkeypatch):
    acked: list[str] = []
    state = {"pending": [], "new": []}

    async def ensure_group(stream):
        return None

    async def read_group(stream, consumer, start_id=">", block_ms=5000, **_):
        if start_id != ">":
            out = [m for m in state["pending"] if m[0] > start_id]
            return out[:10]
        if state["new"]:
            out, state["new"] = state["new"], []
            return out
        raise Stop  # end the endless loop once the test's messages are consumed

    async def ack(stream, msg_id):
        acked.append(msg_id)

    monkeypatch.setattr(stream_runner, "ensure_group", ensure_group)
    monkeypatch.setattr(stream_runner, "read_group", read_group)
    monkeypatch.setattr(stream_runner, "ack", ack)
    return state, acked


async def no_sleep(_):
    return None


async def run(handle):
    with pytest.raises(Stop):
        await stream_runner.run_stream("s", "c", handle, logging.getLogger("t"), sleep=no_sleep)


async def test_transient_error_is_retried_then_acked(fake_stream):
    state, acked = fake_stream
    state["new"] = [("1-0", {"data": "x"})]
    calls = 0

    async def handle(data):
        nonlocal calls
        calls += 1
        if calls < 3:
            raise OperationalError("select 1", {}, ConnectionRefusedError())

    await run(handle)
    assert calls == 3
    assert acked == ["1-0"]


async def test_outage_leaves_message_pending(fake_stream):
    state, acked = fake_stream
    state["new"] = [("1-0", {"data": "x"})]

    async def handle(data):
        raise OperationalError("select 1", {}, ConnectionRefusedError())

    await run(handle)
    assert acked == []


async def test_broken_message_is_acked_without_retry(fake_stream):
    state, acked = fake_stream
    state["new"] = [("1-0", {"data": "not json"})]
    calls = 0

    async def handle(data):
        nonlocal calls
        calls += 1
        raise ValueError("bad payload")

    await run(handle)
    assert calls == 1
    assert acked == ["1-0"]


async def test_pending_messages_are_processed_on_start(fake_stream):
    state, acked = fake_stream
    state["pending"] = [("1-0", {"data": "a"}), ("2-0", {"data": "b"})]
    seen = []

    async def handle(data):
        seen.append(data)

    await run(handle)
    assert seen == ["a", "b"]
    assert acked == ["1-0", "2-0"]
