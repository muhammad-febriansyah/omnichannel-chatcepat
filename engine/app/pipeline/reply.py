"""Reply — satu balasan bot (teks dan/atau media). Dipakai flow_engine, decision,
dan services/inbound supaya bisa kirim foto produk (bukan cuma teks)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Reply:
    # media_url → kirim gambar dengan caption = text. text saja → pesan teks biasa.
    text: str | None = None
    media_url: str | None = None


def text_reply(t: str) -> Reply:
    return Reply(text=t)
