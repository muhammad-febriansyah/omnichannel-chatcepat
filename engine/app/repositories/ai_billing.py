"""AI token balance + usage (migration 0025). Tenant-scoped, raw SQL for clarity.

Balance = sum of non-expired buckets (monthly plan allowance + paid top-ups).
Usage drains the bucket that expires first; the plan allowance for the current
month is created lazily the first time a tenant uses AI that month.
"""

from __future__ import annotations

import math
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Effective plan: the linked plan row, else the first active plan of the tenant's
# tier; an expired subscription falls back to the basic tier (like the web session).
_PLAN_TOKENS = text(
    """
    WITH t AS (
        SELECT id, plan_id,
               CASE WHEN plan_expires_at IS NOT NULL AND plan_expires_at < now()
                    THEN 'basic' ELSE plan::text END AS tier,
               plan_expires_at IS NOT NULL AND plan_expires_at < now() AS expired
        FROM tenants WHERE id = :tenant_id
    )
    SELECT COALESCE(
        (SELECT p.ai_tokens_monthly FROM plans p, t WHERE p.id = t.plan_id AND NOT t.expired),
        (SELECT p.ai_tokens_monthly FROM plans p, t
          WHERE p.tier::text = t.tier AND p.is_active ORDER BY p.sort_order LIMIT 1),
        0
    )
    """
)

# Month boundaries in WIB (what tenants see on their invoice).
_ENSURE_PLAN_BUCKET = text(
    """
    INSERT INTO ai_credit_buckets (tenant_id, source, tokens_total, period_start, expires_at, note)
    SELECT :tenant_id, 'plan', :tokens,
           date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta',
           (date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') + interval '1 month')
               AT TIME ZONE 'Asia/Jakarta',
           'Kuota paket bulanan'
    ON CONFLICT (tenant_id, period_start) WHERE source = 'plan' DO NOTHING
    """
)

_REMAINING = text(
    """
    SELECT COALESCE(SUM(GREATEST(tokens_total - tokens_used, 0)), 0)
    FROM ai_credit_buckets
    WHERE tenant_id = :tenant_id AND (expires_at IS NULL OR expires_at > now())
    """
)


async def ensure_plan_bucket(session: AsyncSession, tenant_id: uuid.UUID) -> None:
    tokens = int((await session.execute(_PLAN_TOKENS, {"tenant_id": tenant_id})).scalar() or 0)
    await session.execute(_ENSURE_PLAN_BUCKET, {"tenant_id": tenant_id, "tokens": tokens})


async def remaining(session: AsyncSession, tenant_id: uuid.UUID) -> int:
    await ensure_plan_bucket(session, tenant_id)
    return int((await session.execute(_REMAINING, {"tenant_id": tenant_id})).scalar() or 0)


def cost(input_tokens: int, output_tokens: int, input_mult: float, output_mult: float) -> int:
    """Tenant tokens charged for one call (rounded up, never negative)."""
    return max(0, math.ceil(input_tokens * input_mult + output_tokens * output_mult))


async def charge(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    feature: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    input_mult: float,
    output_mult: float,
    conversation_id: uuid.UUID | None = None,
) -> int:
    """Deduct from buckets (earliest expiry first) and log usage. Returns tokens charged.

    The call already happened, so a shortfall is still recorded: the remainder lands
    on the first usable bucket (balance goes ≤ 0 and the next call is refused).
    """
    amount = cost(input_tokens, output_tokens, input_mult, output_mult)
    if amount > 0:
        rows = (
            await session.execute(
                text(
                    """
                    SELECT id, tokens_total - tokens_used AS left_
                    FROM ai_credit_buckets
                    WHERE tenant_id = :tenant_id AND (expires_at IS NULL OR expires_at > now())
                    ORDER BY expires_at NULLS LAST, created_at
                    FOR UPDATE
                    """
                ),
                {"tenant_id": tenant_id},
            )
        ).all()
        todo = amount
        for bucket_id, left in rows:
            if todo <= 0:
                break
            take = min(todo, max(int(left), 0))
            if take:
                await _use(session, bucket_id, take)
                todo -= take
        if todo > 0 and rows:
            await _use(session, rows[0][0], todo)
    await session.execute(
        text(
            """
            INSERT INTO ai_usage (tenant_id, feature, model, input_tokens, output_tokens,
                                  charged_tokens, conversation_id)
            VALUES (:tenant_id, :feature, :model, :i, :o, :c, :conv)
            """
        ),
        {
            "tenant_id": tenant_id,
            "feature": feature,
            "model": model,
            "i": input_tokens,
            "o": output_tokens,
            "c": amount,
            "conv": conversation_id,
        },
    )
    return amount


async def _use(session: AsyncSession, bucket_id, tokens: int) -> None:
    await session.execute(
        text("UPDATE ai_credit_buckets SET tokens_used = tokens_used + :n WHERE id = :id"),
        {"n": tokens, "id": bucket_id},
    )
