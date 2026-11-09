"""Endpoint internal /internal/v1 (docs/prd/09). Auth service token."""

from __future__ import annotations

import asyncio

import uuid

import httpx

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel, Field

from ..config import SERVICE_TOKEN
from ..rbac import PermissionDenied, require
from ..services.broadcast import dispatch, run_broadcast
from ..services.conversation import (
    DailyCapReached,
    ServiceWindowClosed,
    assign_conversation,
    send_agent_reply,
    set_handler,
    set_status,
    start_conversation,
)
from ..services.notifications import send_welcome_notification

router = APIRouter(prefix="/internal/v1")


class PasswordResetNotificationIn(BaseModel):
    user_id: uuid.UUID
    token: str = Field(pattern=r"^[a-f0-9]{64}$")


@router.post("/notifications/password-reset")
async def notification_password_reset(payload: PasswordResetNotificationIn, x_service_token: str | None = Header(default=None)) -> dict:
    _auth(x_service_token)
    from ..db import AsyncSessionLocal
    from ..models import User
    from ..services.mailketing import MailketingError, password_reset_email, send_email

    async with AsyncSessionLocal() as session:
        user = await session.get(User, payload.user_id)
        if user is None or user.status != "active":
            return {"sent": False}
        subject, content = password_reset_email(name=user.name, token=payload.token)
        try:
            await send_email(recipient=user.email, subject=subject, content=content)
        except MailketingError as exc:
            raise HTTPException(status_code=503, detail="Layanan email reset belum tersedia") from exc
    return {"sent": True}


def _auth(token: str | None) -> None:
    if not token or token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="service token tidak valid")


def _require(role: str | None, ability: str) -> None:
    """Penegakan RBAC di endpoint internal (selain auth servis). docs/prd/03."""
    try:
        require(role, ability)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=str(e)) from e


def _tenant(x_tenant_id: str | None) -> uuid.UUID:
    """Tenant dari header X-Tenant-Id (di-set BFF dari sesi). Wajib — scope per-tenant."""
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id wajib")
    try:
        return uuid.UUID(x_tenant_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="X-Tenant-Id invalid") from e


class WelcomeNotificationIn(BaseModel):
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    recipient: str
    name: str
    business: str


@router.post("/notifications/welcome")
async def notification_welcome(
    payload: WelcomeNotificationIn,
    background: BackgroundTasks,
    x_service_token: str | None = Header(default=None),
) -> dict:
    """Queue welcome email after a successful self-signup."""
    _auth(x_service_token)
    background.add_task(
        send_welcome_notification,
        tenant_id=payload.tenant_id,
        user_id=payload.user_id,
        recipient=payload.recipient,
        name=payload.name,
        business=payload.business,
    )
    return {"queued": True}


@router.post("/broadcasts/{broadcast_id}/run")
async def broadcasts_run(
    broadcast_id: uuid.UUID,
    background: BackgroundTasks,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Bangun recipients (guard opt_in) lalu dispatch di background (throttle)."""
    _auth(x_service_token)
    _require(x_actor_role, "broadcast.manage")
    try:
        result = await run_broadcast(broadcast_id, _tenant(x_tenant_id))
    except ValueError as e:
        # Channel non-WA (Messenger/IG) / broadcast tak ada → pesan jelas, bukan 500.
        raise HTTPException(status_code=400, detail=str(e)) from e
    if result.get("status") == "running":
        background.add_task(dispatch, broadcast_id)
    return {"data": result}


class ReplyMediaIn(BaseModel):
    url: str  # /uploads/<tenant>/chat/<file> (web upload)
    mime: str
    filename: str | None = None


class ReplyIn(BaseModel):
    body: str = ""
    agent_id: uuid.UUID | None = None
    media: ReplyMediaIn | None = None


@router.post("/conversations/{conversation_id}/reply")
async def conversation_reply(
    conversation_id: uuid.UUID,
    payload: ReplyIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Agen balas percakapan (takeover + kirim). Butuh conversation.takeover."""
    _auth(x_service_token)
    _require(x_actor_role, "conversation.takeover")
    if not payload.body.strip() and payload.media is None:
        raise HTTPException(status_code=422, detail="pesan kosong")
    try:
        result = await send_agent_reply(
            conversation_id,
            payload.body.strip(),
            payload.agent_id,
            _tenant(x_tenant_id),
            media=payload.media.model_dump() if payload.media else None,
        )
    except ServiceWindowClosed as e:
        raise HTTPException(status_code=409, detail=str(e)) from e
    except DailyCapReached as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"data": result}


class StartConversationIn(BaseModel):
    channel_id: uuid.UUID
    phone: str
    name: str | None = None
    type: str = "text"  # "text" | "template"
    body: str | None = None
    template_name: str | None = None
    template_lang: str = "id"
    agent_id: uuid.UUID | None = None


@router.post("/conversations/start")
async def conversation_start(
    payload: StartConversationIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Mulai percakapan baru ke 1 nomor (kirim pesan pertama). Butuh conversation.takeover."""
    _auth(x_service_token)
    _require(x_actor_role, "conversation.takeover")
    if payload.type == "text" and not (payload.body and payload.body.strip()):
        raise HTTPException(status_code=422, detail="pesan kosong")
    if payload.type == "template" and not payload.template_name:
        raise HTTPException(status_code=422, detail="template wajib dipilih")
    try:
        result = await start_conversation(
            _tenant(x_tenant_id),
            payload.channel_id,
            payload.phone,
            name=payload.name,
            msg_type=payload.type,
            body=payload.body.strip() if payload.body else None,
            template_name=payload.template_name,
            template_lang=payload.template_lang,
            agent_id=payload.agent_id,
        )
    except DailyCapReached as e:
        raise HTTPException(status_code=429, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"data": result}


@router.post("/conversations/{conversation_id}/resolve")
async def conversation_resolve(
    conversation_id: uuid.UUID,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Tandai percakapan selesai. Butuh conversation.takeover."""
    _auth(x_service_token)
    _require(x_actor_role, "conversation.takeover")
    return {"data": await set_status(conversation_id, "resolved", _tenant(x_tenant_id))}


@router.post("/conversations/{conversation_id}/reopen")
async def conversation_reopen(
    conversation_id: uuid.UUID,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Buka kembali percakapan yang sudah selesai. Butuh conversation.takeover."""
    _auth(x_service_token)
    _require(x_actor_role, "conversation.takeover")
    return {"data": await set_status(conversation_id, "open", _tenant(x_tenant_id))}


@router.post("/conversations/{conversation_id}/return-to-bot")
async def conversation_return_to_bot(
    conversation_id: uuid.UUID,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Kembalikan penanganan ke AI agent (handler=bot). Butuh conversation.takeover."""
    _auth(x_service_token)
    _require(x_actor_role, "conversation.takeover")
    return {"data": await set_handler(conversation_id, "bot", _tenant(x_tenant_id))}


class AssignIn(BaseModel):
    agent_id: uuid.UUID


@router.post("/conversations/{conversation_id}/assign")
async def conversation_assign(
    conversation_id: uuid.UUID,
    payload: AssignIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Tugaskan percakapan ke agen. Butuh conversation.assign."""
    _auth(x_service_token)
    _require(x_actor_role, "conversation.assign")
    return {
        "data": await assign_conversation(conversation_id, payload.agent_id, _tenant(x_tenant_id))
    }


# --- Knowledge base ingestion (06) ---
class KnowledgeIn(BaseModel):
    tenant_id: uuid.UUID
    title: str
    source_type: str = "manual"
    text: str


@router.post("/knowledge")
async def knowledge_create(
    payload: KnowledgeIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """Buat dokumen KB + ingest (chunk + embed). Butuh knowledge.manage."""
    _auth(x_service_token)
    _require(x_actor_role, "knowledge.manage")
    data = await _create_knowledge_doc(payload.tenant_id, payload.title, payload.source_type, payload.text)
    return {"data": {"document_id": data["document_id"], "chunks": data["chunks"]}}


async def _create_knowledge_doc(tenant_id: uuid.UUID, title: str, source_type: str, text: str, meta: dict | None = None) -> dict:
    """Document row + ingest (chunk + embed) — shared by text, file and URL sources."""
    from ..ai.ingest import ingest
    from ..db import AsyncSessionLocal
    from ..models import KnowledgeDocument

    async with AsyncSessionLocal() as session:
        async with session.begin():
            doc = KnowledgeDocument(
                tenant_id=tenant_id,
                source_type=source_type,
                title=title[:120],
                status="processing",
                meta=meta or {},
            )
            session.add(doc)
            await session.flush()
            doc_id = doc.id
        async with session.begin():
            try:
                n = await ingest(session, doc_id, text)
            except RuntimeError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
    return {"document_id": str(doc_id), "chunks": n, "chars": len(text)}


def _b64(content: str) -> bytes:
    import base64
    import binascii

    try:
        return base64.b64decode(content, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=400, detail="file tidak valid") from e


class KnowledgeFileIn(BaseModel):
    tenant_id: uuid.UUID
    title: str
    filename: str
    content_b64: str


@router.post("/knowledge/file")
async def knowledge_from_file(
    payload: KnowledgeFileIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """PDF / Word / TXT → knowledge document. Needs knowledge.manage."""
    _auth(x_service_token)
    _require(x_actor_role, "knowledge.manage")
    from ..ai.extract import ExtractError, extract_file

    try:
        text = extract_file(payload.filename, _b64(payload.content_b64))
    except ExtractError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    title = payload.title.strip() or payload.filename
    data = await _create_knowledge_doc(payload.tenant_id, title, "file", text, {"filename": payload.filename[:200]})
    return {"data": data}


class KnowledgeUrlIn(BaseModel):
    tenant_id: uuid.UUID
    url: str
    title: str | None = None


@router.post("/knowledge/url")
async def knowledge_from_url(
    payload: KnowledgeUrlIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """One public web page → knowledge document (SSRF-guarded fetch). knowledge.manage."""
    _auth(x_service_token)
    _require(x_actor_role, "knowledge.manage")
    from ..ai.extract import ExtractError, fetch_url_text

    try:
        page_title, text = await fetch_url_text(payload.url)
    except ExtractError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail="Website tidak bisa diakses") from e
    title = (payload.title or "").strip() or page_title or payload.url
    data = await _create_knowledge_doc(payload.tenant_id, title, "url", text, {"url": payload.url[:500]})
    return {"data": data}


class TableIn(BaseModel):
    filename: str
    content_b64: str
    purpose: str  # "products" | "faqs"


@router.post("/files/table")
async def parse_table_file(
    payload: TableIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """CSV / Excel → {columns, rows}; the web app maps and writes them."""
    _auth(x_service_token)
    _require(x_actor_role, "product.manage" if payload.purpose == "products" else "knowledge.manage")
    from ..ai.extract import ExtractError, parse_table

    try:
        return {"data": parse_table(payload.filename, _b64(payload.content_b64))}
    except ExtractError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/knowledge/{document_id}")
async def knowledge_delete(
    document_id: uuid.UUID,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> dict:
    """Hapus dokumen KB + chunks (FK ondelete cascade). knowledge.manage + tenant scope."""
    _auth(x_service_token)
    _require(x_actor_role, "knowledge.manage")
    from sqlalchemy import delete as sa_delete

    from ..db import AsyncSessionLocal
    from ..models import KnowledgeDocument

    tenant = _tenant(x_tenant_id)
    async with AsyncSessionLocal() as session:
        async with session.begin():
            res = await session.execute(
                sa_delete(KnowledgeDocument).where(
                    KnowledgeDocument.id == document_id,
                    KnowledgeDocument.tenant_id == tenant,
                )
            )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="dokumen tidak ada")
    return {"data": {"deleted": str(document_id)}}


# --- AI agent simulator (06) ---
class PreviewIn(BaseModel):
    tenant_id: uuid.UUID
    message: str
    persona: str | None = None  # legacy single-persona preview
    agent: dict | None = None  # unsaved agent form values (AgentSpec fields)
    tones: list[str] | None = None  # answer once per tone to compare styles


@router.post("/ai-agent/preview")
async def ai_preview(
    payload: PreviewIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """Try an agent (style + knowledge + promos) without saving. Needs knowledge.manage."""
    _auth(x_service_token)
    _require(x_actor_role, "knowledge.manage")
    from dataclasses import replace

    from ..ai import registry
    from ..ai.agent import build_system_prompt
    from ..ai.llm import run_chat
    from ..ai.styles import TONE_GUIDE, AgentSpec
    from ..db import AsyncSessionLocal
    from ..repositories import ai_billing

    message = payload.message.strip()[:1000]
    if not message:
        raise HTTPException(status_code=400, detail="pesan kosong")
    spec = AgentSpec.from_dict(payload.agent) if payload.agent else AgentSpec(role="sales", instructions=payload.persona)
    tones = [t for t in (payload.tones or []) if t in TONE_GUIDE][:4] or [spec.tone]

    async with AsyncSessionLocal() as session, session.begin():
        model = await registry.resolve(session, "simulator")
        if model is None:
            return {"data": {"enabled": False, "answer": None, "answers": []}}
        if await ai_billing.remaining(session, payload.tenant_id) <= 0:
            return {"data": {"enabled": True, "quota_exceeded": True, "answer": None, "answers": []}}
        # Prompts need the DB (sequential); the LLM calls run in parallel; then charge.
        prompts = []
        for tone in tones:
            prompts.append(await build_system_prompt(session, payload.tenant_id, replace(spec, tone=tone), message))
        results = await asyncio.gather(*(run_chat(model.provider, system, message) for system, _ in prompts))
        for r in results:
            await ai_billing.charge(
                session,
                payload.tenant_id,
                feature="simulator",
                model=model.model,
                input_tokens=r.input_tokens,
                output_tokens=r.output_tokens,
                input_mult=model.input_mult,
                output_mult=model.output_mult,
            )
    from ..ai.agent import strip_unknown_marker

    replies = [strip_unknown_marker(r.text or "")[0] for r in results]
    sources = prompts[0][1] if prompts else []
    answers = [{"tone": t, "answer": (r or "").strip()} for t, r in zip(tones, replies)]
    return {
        "data": {
            "enabled": True,
            "answer": answers[0]["answer"],
            "answers": answers,
            "kb_used": any(s for s in sources if not s.startswith("Info bisnis")),
            "sources": sources,
        }
    }


@router.get("/ai-agent/status")
async def ai_status(x_service_token: str | None = Header(default=None)) -> dict:
    """Status AI: apakah LLM provider terkonfigurasi (env engine). Untuk indikator UI."""
    _auth(x_service_token)
    from ..ai import registry
    from ..db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        return {"data": {"enabled": await registry.resolve(session, "flow_reply") is not None}}
