"""Audit log aksi sensitif (docs/prd/03): connect channel, kirim broadcast, ubah role,
hapus kontak massal, export kontak. Dipakai engine & (mirror) web.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AuditLog


async def write(
    session: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    action: str,
    entity: str,
    actor_id: uuid.UUID | None = None,
    entity_id: str | None = None,
    diff: dict | None = None,
) -> AuditLog:
    log = AuditLog(
        tenant_id=tenant_id,
        actor_id=actor_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        diff=diff or {},
    )
    session.add(log)
    await session.flush()
    return log
