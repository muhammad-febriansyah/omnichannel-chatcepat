"""Which model powers each AI feature (superadmin → AI settings, migration 0025).

resolve(session, feature) returns the provider + model + token multipliers. When the
superadmin has not set a model for a feature, the env provider (LLM_PROVIDER) is used
with multiplier 1, so existing installs keep working.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import EMBEDDING_MODEL, LLM_MODEL, LLM_PROVIDER, OPENAI_CHAT_MODEL
from . import secrets
from .llm import AnthropicProvider, LLMProvider, OpenAIProvider, get_provider

FEATURES = ("flow_reply", "simulator", "embedding")
_TTL = 30.0  # seconds; superadmin changes apply within half a minute


@dataclass
class Resolved:
    provider: LLMProvider
    model: str
    input_mult: float
    output_mult: float


_cache: dict[str, tuple[float, Resolved | None]] = {}
_instances: dict[tuple, LLMProvider] = {}

_QUERY = text(
    """
    SELECT f.is_enabled, m.model, m.input_multiplier, m.output_multiplier, m.is_active AS model_active,
           p.id AS provider_id, p.kind, p.api_key, p.base_url, p.is_active AS provider_active,
           p.updated_at
    FROM ai_features f
    LEFT JOIN ai_models m ON m.id = f.model_id
    LEFT JOIN ai_providers p ON p.id = m.provider_id
    WHERE f.feature = :feature
    """
)


def clear_cache() -> None:
    _cache.clear()
    _instances.clear()


def _env_fallback(feature: str) -> Resolved | None:
    provider = get_provider()
    if provider is None or not getattr(provider, "enabled", False):
        return None
    name = (LLM_PROVIDER or "").lower()
    if feature == "embedding":
        model = EMBEDDING_MODEL
    else:
        model = OPENAI_CHAT_MODEL if name == "openai" else LLM_MODEL if name else "env"
    return Resolved(provider=provider, model=model, input_mult=1.0, output_mult=1.0)


def _build(row, feature: str) -> LLMProvider:
    key = (row.provider_id, row.model, str(row.updated_at))
    if key in _instances:
        return _instances[key]
    api_key = secrets.decrypt(row.api_key)
    if row.kind == "anthropic":
        inst: LLMProvider = AnthropicProvider(api_key, row.model)
    else:
        base_url = row.base_url if row.kind == "openai_compatible" else None
        chat_model = row.model if feature != "embedding" else OPENAI_CHAT_MODEL
        embed_model = row.model if feature == "embedding" else EMBEDDING_MODEL
        inst = OpenAIProvider(api_key, chat_model, embed_model, base_url=base_url)
    _instances[key] = inst
    return inst


async def resolve(session: AsyncSession | None, feature: str) -> Resolved | None:
    """None = AI off for this feature (disabled by superadmin, or nothing configured)."""
    if session is None:  # unit tests / no DB → injected or env provider
        return _env_fallback(feature)
    hit = _cache.get(feature)
    if hit and time.monotonic() - hit[0] < _TTL:
        return hit[1]
    row = (await session.execute(_QUERY, {"feature": feature})).first()
    if row is not None and not row.is_enabled:
        resolved = None
    elif row is None or row.model is None or not row.model_active or not row.provider_active:
        resolved = _env_fallback(feature)
    else:
        resolved = Resolved(
            provider=_build(row, feature),
            model=row.model,
            input_mult=float(row.input_multiplier),
            output_mult=float(row.output_multiplier),
        )
    _cache[feature] = (time.monotonic(), resolved)
    return resolved
