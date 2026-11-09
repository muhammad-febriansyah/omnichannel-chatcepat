"""Decrypt secrets the web stored with CHANNEL_CRED_KEY (AES-256-GCM, `enc:v1:` prefix).

Same format as web/lib/channel-crypto.ts: base64(nonce(12) || ciphertext || tag(16)).
Plain values (dev without a key) pass through unchanged.
"""

from __future__ import annotations

import base64
import os

PREFIX = "enc:v1:"


def decrypt(value: str | None) -> str:
    if not value:
        return ""
    if not value.startswith(PREFIX):
        return value
    raw_key = os.environ.get("CHANNEL_CRED_KEY", "")
    if not raw_key:
        raise RuntimeError("CHANNEL_CRED_KEY belum di-set — tidak bisa membaca API key AI")
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    data = base64.b64decode(value[len(PREFIX) :])
    nonce, body = data[:12], data[12:]  # body = ciphertext || tag (AESGCM layout)
    return AESGCM(base64.b64decode(raw_key)).decrypt(nonce, body, None).decode("utf-8")
