"""AI calls that respect the tenant's token balance and record usage.

Every tenant-facing AI call goes through here: pick the model for the feature
(registry), refuse when the balance is used up, then charge the tokens spent.
session=None (unit tests) skips billing.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories import ai_billing as billing
from . import registry
from .llm import ChatResult, Turn, run_chat, run_embed


class QuotaExceeded(Exception):
    """The tenant has no AI tokens left this period."""


async def has_balance(session: AsyncSession | None, tenant_id: uuid.UUID) -> bool:
    if session is None:
        return True
    return await billing.remaining(session, tenant_id) > 0


async def chat(
    session: AsyncSession | None,
    tenant_id: uuid.UUID,
    feature: str,
    system: str,
    user: str,
    history: list[Turn] | None = None,
    conversation_id: uuid.UUID | None = None,
) -> ChatResult | None:
    """None = AI off for this feature. Raises QuotaExceeded when tokens ran out."""
    model = await registry.resolve(session, feature)
    if model is None:
        return None
    if not await has_balance(session, tenant_id):
        raise QuotaExceeded
    result = await run_chat(model.provider, system, user, history)
    if session is not None:
        await billing.charge(
            session,
            tenant_id,
            feature=feature,
            model=model.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            input_mult=model.input_mult,
            output_mult=model.output_mult,
            conversation_id=conversation_id,
        )
    return result


async def embed(
    session: AsyncSession | None, tenant_id: uuid.UUID, text: str
) -> list[float] | None:
    """Embedding vector, or None (no embedding model / no balance → keyword search)."""
    model = await registry.resolve(session, "embedding")
    if model is None or not await has_balance(session, tenant_id):
        return None
    try:
        vec, tokens = await run_embed(model.provider, text)
    except NotImplementedError:
        return None
    if session is not None:
        await billing.charge(
            session,
            tenant_id,
            feature="embedding",
            model=model.model,
            input_tokens=tokens,
            output_tokens=0,
            input_mult=model.input_mult,
            output_mult=model.output_mult,
        )
    return vec
