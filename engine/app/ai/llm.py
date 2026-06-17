"""Abstraksi LLMProvider supaya provider bisa diganti (docs/prd/06 TODO PRODUK).

Default: DISABLED (AI nonaktif → fallback). `LLM_PROVIDER=echo` untuk dev/test.
`anthropic`/`claude` & `openai` = real (butuh LLM_API_KEY).
"""

from __future__ import annotations

import hashlib
import math
import re
from typing import Protocol, runtime_checkable

from ..config import (
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    LLM_API_KEY,
    LLM_MAX_TOKENS,
    LLM_MODEL,
    LLM_PROVIDER,
    OPENAI_CHAT_MODEL,
)

_TOKEN = re.compile(r"\w+")

# Turn = satu giliran percakapan untuk memori AI. role: "user" | "assistant".
Turn = dict[str, str]


@runtime_checkable
class LLMProvider(Protocol):
    enabled: bool

    async def complete(
        self, system: str, user: str, history: list[Turn] | None = None
    ) -> str: ...

    async def embed(self, text: str) -> list[float]: ...


def _hash_embed(text: str, dim: int) -> list[float]:
    """Embedding deterministik (bag-of-words ter-hash). Untuk dev/test tanpa API."""
    vec = [0.0] * dim
    for tok in _TOKEN.findall(text.lower()):
        idx = int(hashlib.md5(tok.encode()).hexdigest(), 16) % dim
        vec[idx] += 1.0
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


class EchoProvider:
    """Provider dev/test: jawaban gema + embedding ter-hash. Tanpa jaringan."""

    enabled = True

    async def complete(
        self, system: str, user: str, history: list[Turn] | None = None
    ) -> str:
        return f"(echo) {user.strip()}"

    async def embed(self, text: str) -> list[float]:
        return _hash_embed(text, EMBEDDING_DIM)


class AnthropicProvider:
    """Real Claude via Anthropic SDK (messages API). Anthropic tak punya endpoint
    embedding — `embed()` raise NotImplementedError, agent.try_ai jawab tanpa RAG.
    Untuk KB/RAG pakai OpenAIProvider (atau Voyage). Lihat docs/prd/06."""

    enabled = True

    def __init__(self, api_key: str, model: str) -> None:
        from anthropic import AsyncAnthropic

        self.client = AsyncAnthropic(api_key=api_key)
        self.model = model

    async def complete(
        self, system: str, user: str, history: list[Turn] | None = None
    ) -> str:
        messages = [*(history or []), {"role": "user", "content": user}]
        resp = await self.client.messages.create(
            model=self.model,
            max_tokens=LLM_MAX_TOKENS,
            system=system,
            messages=messages,
        )
        # content = list block; ambil teks saja (skip thinking/tool_use bila ada).
        return "".join(b.text for b in resp.content if b.type == "text")

    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError("Anthropic tak punya embedding API — pakai provider lain")


class OpenAIProvider:
    """Real OpenAI: chat completions + embeddings (text-embedding-3-small = 1536 dim,
    pas dgn pgvector). Lihat docs/prd/06."""

    enabled = True

    def __init__(self, api_key: str, chat_model: str, embed_model: str) -> None:
        from openai import AsyncOpenAI

        self.client = AsyncOpenAI(api_key=api_key)
        self.chat_model = chat_model
        self.embed_model = embed_model

    async def complete(
        self, system: str, user: str, history: list[Turn] | None = None
    ) -> str:
        messages = [
            {"role": "system", "content": system},
            *(history or []),
            {"role": "user", "content": user},
        ]
        resp = await self.client.chat.completions.create(
            model=self.chat_model,
            messages=messages,
        )
        return resp.choices[0].message.content or ""

    async def embed(self, text: str) -> list[float]:
        resp = await self.client.embeddings.create(model=self.embed_model, input=text)
        return resp.data[0].embedding


_provider: LLMProvider | None = None
_resolved = False


def get_provider() -> LLMProvider | None:
    """None = AI nonaktif (fallback). Cached per proses."""
    global _provider, _resolved
    if _resolved:
        return _provider
    _resolved = True
    name = (LLM_PROVIDER or "").lower()
    if name == "echo":
        _provider = EchoProvider()
    elif name == "openai" and LLM_API_KEY:
        _provider = OpenAIProvider(LLM_API_KEY, OPENAI_CHAT_MODEL, EMBEDDING_MODEL)
    elif name in ("anthropic", "claude") and LLM_API_KEY:
        _provider = AnthropicProvider(LLM_API_KEY, LLM_MODEL)
    else:
        _provider = None
    return _provider


def reset_provider() -> None:
    """Reset cache (untuk test inject provider)."""
    global _provider, _resolved
    _provider = None
    _resolved = False


def set_provider(p: LLMProvider | None) -> None:
    global _provider, _resolved
    _provider = p
    _resolved = True
