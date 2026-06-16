"""Endpoint internal /internal/v1 (docs/prd/09). Auth service token."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException

from ..config import SERVICE_TOKEN
from ..rbac import PermissionDenied, require
from ..services.broadcast import dispatch, run_broadcast

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
