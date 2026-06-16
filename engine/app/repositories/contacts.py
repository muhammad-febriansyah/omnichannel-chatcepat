from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Contact


async def get_or_create(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    external_id: str | None,
    phone: str | None,
    name: str | None,
) -> Contact:
    """Cari kontak per tenant (by external_id lalu phone), atau buat baru.

    Kontak yang chat duluan = inbound → opted_in (consent implisit, docs/prd/07).
    """
    stmt = select(Contact).where(Contact.tenant_id == tenant_id)
    contact: Contact | None = None
    if external_id:
        contact = await session.scalar(stmt.where(Contact.external_id == external_id))
    if contact is None and phone:
        contact = await session.scalar(stmt.where(Contact.phone == phone))

    if contact is not None:
        if name and not contact.name:
            contact.name = name
        contact.last_contacted_at = datetime.now(timezone.utc)
        return contact

    contact = Contact(
        tenant_id=tenant_id,
        external_id=external_id,
        phone=phone,
        name=name,
        opt_in_status="opted_in",
        opt_in_source="inbound",
        opt_in_at=datetime.now(timezone.utc),
        last_contacted_at=datetime.now(timezone.utc),
    )
    session.add(contact)
    await session.flush()
    return contact
