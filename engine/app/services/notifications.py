"""Transactional email delivery and subscription reminder orchestration."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import AsyncSessionLocal
from ..models import EmailNotification, Tenant, User
from .mailketing import (
    MailketingError,
    plan_expired_email,
    plan_expiry_3d_email,
    send_email,
    welcome_email,
)

log = logging.getLogger("engine.notifications")


async def _send_once(
    session: AsyncSession,
    *,
    tenant_id,
    user_id,
    kind: str,
    dedupe_key: str,
    recipient: str,
    subject: str,
    content: str,
) -> bool:
    delivery = await session.scalar(
        select(EmailNotification).where(EmailNotification.dedupe_key == dedupe_key)
    )
    if delivery and delivery.status == "sent":
        return False

    if delivery is None:
        delivery = EmailNotification(
            tenant_id=tenant_id,
            user_id=user_id,
            kind=kind,
            dedupe_key=dedupe_key,
            recipient=recipient,
            status="sending",
        )
        session.add(delivery)
    else:
        delivery.status = "sending"
        delivery.error_message = None
        delivery.recipient = recipient

    await session.flush()
    try:
        await send_email(recipient=recipient, subject=subject, content=content)
    except MailketingError as exc:
        delivery.status = "failed"
        delivery.error_message = str(exc)
        await session.commit()
        log.error("email notification failed kind=%s tenant_id=%s", kind, tenant_id)
        return False

    delivery.status = "sent"
    delivery.sent_at = datetime.now(timezone.utc)
    await session.commit()
    log.info("email notification sent kind=%s tenant_id=%s", kind, tenant_id)
    return True


async def send_welcome_notification(
    *, tenant_id, user_id, recipient: str, name: str, business: str
) -> bool:
    subject, content = welcome_email(name=name, business=business)
    async with AsyncSessionLocal() as session:
        return await _send_once(
            session,
            tenant_id=tenant_id,
            user_id=user_id,
            kind="welcome",
            dedupe_key=f"welcome:user:{user_id}",
            recipient=recipient,
            subject=subject,
            content=content,
        )


async def send_plan_expiry_notifications() -> int:
    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=3)).date()
    sent = 0
    async with AsyncSessionLocal() as session:
        tenants = await session.scalars(
            select(Tenant).where(Tenant.plan_expires_at.is_not(None))
        )
        for tenant in tenants:
            expiry = tenant.plan_expires_at
            if expiry is None:
                continue
            user = await session.scalar(
                select(User)
                .where(
                    User.tenant_id == tenant.id,
                    User.role == "client",
                    User.status == "active",
                )
                .order_by(User.created_at)
                .limit(1)
            )
            if user is None:
                continue

            if expiry.date() == target_date:
                subject, content = plan_expiry_3d_email(
                    name=user.name, expires_at=expiry
                )
                delivered = await _send_once(
                    session,
                    tenant_id=tenant.id,
                    user_id=user.id,
                    kind="plan_expiry_3d",
                    dedupe_key=f"plan-expiry-3d:tenant:{tenant.id}:expiry:{expiry.isoformat()}",
                    recipient=user.email,
                    subject=subject,
                    content=content,
                )
                sent += int(delivered)
            elif expiry <= now:
                subject, content = plan_expired_email(
                    name=user.name, expires_at=expiry
                )
                delivered = await _send_once(
                    session,
                    tenant_id=tenant.id,
                    user_id=user.id,
                    kind="plan_expired",
                    dedupe_key=f"plan-expired:tenant:{tenant.id}:expiry:{expiry.isoformat()}",
                    recipient=user.email,
                    subject=subject,
                    content=content,
                )
                sent += int(delivered)
    return sent
