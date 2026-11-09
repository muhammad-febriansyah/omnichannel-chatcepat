"""Reply — satu balasan bot (teks dan/atau media). Dipakai flow_engine, decision,
dan services/inbound supaya bisa kirim foto produk (bukan cuma teks)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Reply:
    # media_url → kirim gambar dengan caption = text. text saja → pesan teks biasa.
    text: str | None = None
    media_url: str | None = None
    # (id, title) pilihan. WA Official → tombol/list asli; channel lain → teks bernomor.
    buttons: list[tuple[str, str]] = field(default_factory=list)
    # Comment-triggered flows: "comment_reply" = public reply under the comment,
    # "private_reply" = one DM to the commenter. None = normal chat message.
    mode: str | None = None


def options_as_text(text: str | None, buttons: list[tuple[str, str]]) -> str:
    """Fallback teks untuk channel tanpa tombol: tambahkan pilihan yang belum tertulis."""
    base = (text or "").rstrip()
    lowered = base.casefold()
    missing = [(i, t) for i, t in buttons if t.casefold() not in lowered]
    if not missing:
        return base
    lines = [f"{i}. {t}" for i, t in missing]
    return (base + "\n\n" if base else "") + "\n".join(lines)


def text_reply(t: str) -> Reply:
    return Reply(text=t)
