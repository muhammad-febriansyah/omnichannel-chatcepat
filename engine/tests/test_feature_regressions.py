"""Service regressions against isolated PostgreSQL, with outbound delivery mocked."""

import asyncio
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base, Broadcast, Channel, Contact, Conversation, Flow, Message, Tenant, User
from app.contracts.events import InboundMessage
from app.services import broadcast, conversation, inbound, status


@pytest_asyncio.fixture
async def service_db(monkeypatch):
    dsn = os.getenv("SOCIAL_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("requires isolated SOCIAL_TEST_DATABASE_URL")
    dsn = dsn.replace("postgres://", "postgresql+asyncpg://", 1).split("?")[0]
    admin = create_async_engine(dsn)
    schema = "feature_test_" + uuid.uuid4().hex
    async with admin.begin() as connection:
        await connection.execute(sa.text(f"CREATE SCHEMA {schema}"))
    engine = create_async_engine(dsn, connect_args={"server_settings": {"search_path": schema}})
    names = {"tenants", "users", "channels", "contacts", "conversations", "messages", "flows", "conversation_states", "broadcasts", "broadcast_recipients"}
    tables = [table for table in Base.metadata.tables.values() if table.name in names]
    async with engine.begin() as connection:
        def create_schema(sync):
            for table in tables:
                for column in table.columns:
                    if isinstance(column.type, sa.Enum):
                        column.type.create(sync, checkfirst=True)
            Base.metadata.create_all(sync, tables=tables)
        await connection.run_sync(create_schema)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    sent = AsyncMock(return_value="1-0")
    for module in (broadcast, conversation, inbound, status):
        monkeypatch.setattr(module, "AsyncSessionLocal", factory)
        if hasattr(module, "publish_outbound"):
            monkeypatch.setattr(module, "publish_outbound", sent)
        if hasattr(module, "publish_realtime"):
            monkeypatch.setattr(module, "publish_realtime", AsyncMock())
    monkeypatch.setattr(broadcast, "engine", engine)
    try:
        yield factory, sent
    finally:
        await engine.dispose()
        async with admin.begin() as connection:
            await connection.execute(sa.text(f"DROP SCHEMA {schema} CASCADE"))
        await admin.dispose()


async def seed(factory, channel_type="wa_unofficial"):
    async with factory() as session, session.begin():
        tenant = Tenant(name="Audit", slug=uuid.uuid4().hex)
        session.add(tenant)
        await session.flush()
        channel = Channel(tenant_id=tenant.id, type=channel_type, name="Audit channel", status="connected", auto_reply_enabled=True, auto_reply_mode="menu")
        session.add(channel)
        await session.flush()
        return tenant.id, channel.id


def incoming(channel_id, body="halo", message_id=None):
    mid = message_id or uuid.uuid4().hex
    return InboundMessage.model_validate({
        "event_id": uuid.uuid4().hex, "dedup_key": f"{channel_id}:{mid}",
        "channel_id": str(channel_id), "channel_type": "wa_unofficial",
        "from": {"external_id": "628123456789", "phone": "628123456789", "name": "Budi"},
        "type": "text", "body": body, "provider_message_id": mid,
        "timestamp": datetime.now(timezone.utc),
    })


async def test_unofficial_autoreply_transaction_and_replay(service_db):
    factory, sent = service_db
    _, cid = await seed(factory)
    event = incoming(cid)
    await inbound.handle(event)
    await inbound.handle(event)
    async with factory() as session:
        assert await session.scalar(sa.select(sa.func.count()).select_from(Message)) == 2
    assert sent.await_count == 1


async def test_broadcast_rechecks_optout_and_serializes_dispatch(service_db):
    factory, sent = service_db
    tid, cid = await seed(factory)
    async with factory() as session, session.begin():
        contacts = [Contact(tenant_id=tid, phone=f"62812345678{i}", opt_in_status="opted_in") for i in range(3)]
        session.add_all(contacts)
        campaign = Broadcast(tenant_id=tid, channel_id=cid, name="Audit", body_snapshot="Info")
        session.add(campaign)
        await session.flush()
        bid, optout_id = campaign.id, contacts[0].id
    await broadcast.run_broadcast(bid, tid)
    async with factory() as session, session.begin():
        await session.execute(sa.update(Contact).where(Contact.id == optout_id).values(opt_in_status="opted_out"))
    async def publish(_payload):
        await asyncio.sleep(0.05)
        return "1-0"
    sent.side_effect = publish
    await asyncio.gather(broadcast.dispatch(bid, throttle_s=0), broadcast.dispatch(bid, throttle_s=0))
    assert sent.await_count == 2
    async with factory() as session:
        result = await session.get(Broadcast, bid)
        assert result.status == "done"
        assert result.stats["sent"] == 2
        assert result.stats["skipped_optout"] == 1


async def test_compose_rejects_non_whatsapp_phone_and_empty_text(service_db):
    factory, sent = service_db
    tid, cid = await seed(factory, "telegram")
    with pytest.raises(ValueError, match="hanya untuk WhatsApp"):
        await conversation.start_conversation(tid, cid, "08123456789", body="halo")
    with pytest.raises(ValueError, match="pesan kosong"):
        await conversation.start_conversation(tid, cid, "08123456789", body=" ")
    assert sent.await_count == 0


async def test_assign_rejects_other_tenant_agent(service_db):
    factory, _ = service_db
    tid, cid = await seed(factory)
    other_tid, _ = await seed(factory)
    async with factory() as session, session.begin():
        contact = Contact(tenant_id=tid, phone="62812345678")
        agent = User(tenant_id=other_tid, name="Other", email="other@example.test", password_hash="unused", role="client", status="active")
        session.add_all([contact, agent])
        await session.flush()
        conv = Conversation(tenant_id=tid, channel_id=cid, contact_id=contact.id)
        session.add(conv)
        await session.flush()
        conv_id, agent_id = conv.id, agent.id
    with pytest.raises(ValueError, match="tenant ini"):
        await conversation.assign_conversation(conv_id, agent_id, tid)


async def test_disabled_flow_does_not_resume_and_fallback_triggers(service_db):
    factory, sent = service_db
    tid, cid = await seed(factory)
    async with factory() as session, session.begin():
        flow = Flow(tenant_id=tid, name="Fallback", trigger="fallback", status="active", definition={"nodes": [
            {"id": "start", "type": "trigger", "trigger": {"kind": "fallback"}, "next": "text"},
            {"id": "text", "type": "send_text", "text": "Fallback aktif", "next": "wait"},
            {"id": "wait", "type": "wait_reply", "next": "old"},
            {"id": "old", "type": "send_text", "text": "BUG disabled flow"},
        ]})
        session.add(flow)
        await session.flush()
        fid = flow.id
    await inbound.handle(incoming(cid))
    assert "Fallback aktif" in sent.call_args.args[0]
    async with factory() as session, session.begin():
        await session.execute(sa.update(Flow).where(Flow.id == fid).values(status="draft"))
    await inbound.handle(incoming(cid, "jawaban"))
    assert "BUG disabled flow" not in sent.call_args.args[0]


@pytest.mark.parametrize("raw,expected", [("0812-3456-789", "628123456789"), ("+81 9012345678", "819012345678"), ("0081 9012345678", "819012345678")])
def test_international_phone_not_rewritten_as_indonesian(raw, expected):
    assert conversation._normalize_phone(raw) == expected
