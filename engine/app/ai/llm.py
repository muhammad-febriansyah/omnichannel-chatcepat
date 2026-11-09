"""Abstraksi LLMProvider supaya provider bisa diganti (docs/prd/06 TODO PRODUK).

Default: DISABLED (AI nonaktif → fallback). `LLM_PROVIDER=echo` untuk dev/test.
`anthropic`/`claude` & `openai` = real (butuh LLM_API_KEY).
"""

from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
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


@dataclass
class ChatResult:
    """One completion plus token counts (for billing tenants' AI tokens)."""

    text: str
    input_tokens: int
    output_tokens: int


def estimate_tokens(text: str) -> int:
    """Rough token count (~4 chars/token) for providers that report no usage."""
    return max(1, len(text or "") // 4)


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
        return (await self.chat(system, user, history)).text

    async def chat(
        self, system: str, user: str, history: list[Turn] | None = None
    ) -> ChatResult:
        messages = [*(history or []), {"role": "user", "content": user}]
        resp = await self.client.messages.create(
            model=self.model,
            max_tokens=LLM_MAX_TOKENS,
            system=system,
            messages=messages,
        )
        # content = list block; ambil teks saja (skip thinking/tool_use bila ada).
        text = "".join(b.text for b in resp.content if b.type == "text")
        usage = getattr(resp, "usage", None)
        return ChatResult(
            text=text,
            input_tokens=int(getattr(usage, "input_tokens", 0) or 0),
            output_tokens=int(getattr(usage, "output_tokens", 0) or 0),
        )

    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError("Anthropic tak punya embedding API — pakai provider lain")


class OpenAIProvider:
    """Real OpenAI: chat completions + embeddings (text-embedding-3-small = 1536 dim,
    pas dgn pgvector). Lihat docs/prd/06."""

    enabled = True

    def __init__(
        self, api_key: str, chat_model: str, embed_model: str, base_url: str | None = None
    ) -> None:
        from openai import AsyncOpenAI

        # base_url = any OpenAI-compatible API (Gemini, DeepSeek, OpenRouter, Groq, …).
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url or None)
        self.chat_model = chat_model
        self.embed_model = embed_model

    async def complete(
        self, system: str, user: str, history: list[Turn] | None = None
    ) -> str:
        return (await self.chat(system, user, history)).text

    async def chat(
        self, system: str, user: str, history: list[Turn] | None = None
    ) -> ChatResult:
        messages = [
            {"role": "system", "content": system},
            *(history or []),
            {"role": "user", "content": user},
        ]
        resp = await self.client.chat.completions.create(
            model=self.chat_model,
            messages=messages,
            max_tokens=LLM_MAX_TOKENS,
        )
        usage = getattr(resp, "usage", None)
        return ChatResult(
            text=resp.choices[0].message.content or "",
            input_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
            output_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
        )

    async def embed(self, text: str) -> list[float]:
        return (await self.embed_with_usage(text))[0]

    async def embed_with_usage(self, text: str) -> tuple[list[float], int]:
        resp = await self.client.embeddings.create(model=self.embed_model, input=text)
        usage = getattr(resp, "usage", None)
        tokens = int(getattr(usage, "total_tokens", 0) or 0) or estimate_tokens(text)
        return resp.data[0].embedding, tokens


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


# --- Usage-aware helpers (work with any provider, incl. test fakes) -------------------


async def run_chat(
    provider: LLMProvider, system: str, user: str, history: list[Turn] | None = None
) -> ChatResult:
    chat = getattr(provider, "chat", None)
    if chat is not None:
        return await chat(system, user, history)
    text = await provider.complete(system, user, history)
    prompt = system + user + "".join(t.get("content", "") for t in history or [])
    return ChatResult(text=text or "", input_tokens=estimate_tokens(prompt), output_tokens=estimate_tokens(text))


async def run_embed(provider: LLMProvider, text: str) -> tuple[list[float], int]:
    """Embedding + tokens used. Raises NotImplementedError like provider.embed."""
    with_usage = getattr(provider, "embed_with_usage", None)
    if with_usage is not None:
        return await with_usage(text)
    return await provider.embed(text), estimate_tokens(text)
