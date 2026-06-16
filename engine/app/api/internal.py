"""Endpoint internal /internal/v1 (docs/prd/09). Auth service token."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel

from ..config import SERVICE_TOKEN
from ..rbac import PermissionDenied, require
from ..services.broadcast import dispatch, run_broadcast
from ..services.conversation import send_agent_reply

router = APIRouter(prefix="/internal/v1")


def _auth(token: str | None) -> None:
    if not token or token != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="service token tidak valid")


def _require(role: str | None, ability: str) -> None:
    """Penegakan RBAC di endpoint internal (selain auth servis). docs/prd/03."""
    try:
        require(role, ability)
    except PermissionDenied as e:
        raise HTTPException(status_code=403, detail=str(e)) from e


@router.post("/broadcasts/{broadcast_id}/run")
async def broadcasts_run(
    broadcast_id: uuid.UUID,
    background: BackgroundTasks,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """Bangun recipients (guard opt_in) lalu dispatch di background (throttle)."""
    _auth(x_service_token)
    _require(x_actor_role, "broadcast.manage")
    result = await run_broadcast(broadcast_id)
    if result.get("status") == "running":
        background.add_task(dispatch, broadcast_id)
    return {"data": result}


class ReplyIn(BaseModel):
    body: str
    agent_id: uuid.UUID | None = None


@router.post("/conversations/{conversation_id}/reply")
async def conversation_reply(
    conversation_id: uuid.UUID,
    payload: ReplyIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """Agen balas percakapan (takeover + kirim). Butuh conversation.takeover."""
    _auth(x_service_token)
    _require(x_actor_role, "conversation.takeover")
    if not payload.body.strip():
        raise HTTPException(status_code=422, detail="pesan kosong")
    result = await send_agent_reply(conversation_id, payload.body.strip(), payload.agent_id)
    return {"data": result}


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
    from ..ai.ingest import ingest
    from ..db import AsyncSessionLocal
    from ..models import KnowledgeDocument

    async with AsyncSessionLocal() as session:
        async with session.begin():
            doc = KnowledgeDocument(
                tenant_id=payload.tenant_id,
                source_type=payload.source_type,
                title=payload.title,
                status="processing",
            )
            session.add(doc)
            await session.flush()
            doc_id = doc.id
        async with session.begin():
            try:
                n = await ingest(session, doc_id, payload.text)
            except RuntimeError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
    return {"data": {"document_id": str(doc_id), "chunks": n}}


# --- AI agent preview (06) ---
class PreviewIn(BaseModel):
    tenant_id: uuid.UUID
    message: str
    persona: str | None = None


@router.post("/ai-agent/preview")
async def ai_preview(
    payload: PreviewIn,
    x_service_token: str | None = Header(default=None),
    x_actor_role: str | None = Header(default=None),
) -> dict:
    """Uji jawaban AI agent (RAG + LLM). Butuh knowledge.manage."""
    _auth(x_service_token)
    _require(x_actor_role, "knowledge.manage")
    from ..ai import rag
    from ..ai.agent import DEFAULT_PERSONA
    from ..ai.llm import get_provider
    from ..db import AsyncSessionLocal

    provider = get_provider()
    if provider is None:
        return {"data": {"enabled": False, "answer": None}}

    kb = ""
    try:
        vec = await provider.embed(payload.message)
        async with AsyncSessionLocal() as session:
            chunks = await rag.retrieve(session, payload.tenant_id, vec, 5)
        kb = "\n\n".join(c.content for c in chunks)
    except NotImplementedError:
        pass

    system = payload.persona or DEFAULT_PERSONA
    if kb:
        system += f"\n\nPengetahuan (jawab hanya dari sini):\n{kb}"
    answer = await provider.complete(system, payload.message)
    return {"data": {"enabled": True, "answer": answer, "kb_used": bool(kb)}}
