"""Broadcast compliant (docs/prd/07).

Aturan keras (anti-spam by design):
- Hanya kontak `opted_in` yang dikirimi. `opted_out` → skipped_optout (tercatat).
  `unknown` dikecualikan. Guard di LEVEL DATA, bukan UI.
- Throttle outbound (official: rate Meta; unofficial: jeda acak besar, rawan banned).
"""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin

from sqlalchemy import text

from ..bus import publish_outbound
from ..config import (
    APP_BASE_URL,
    BROADCAST_BATCH,
    BROADCAST_REST_EVERY,
    BROADCAST_REST_MAX_S,
    BROADCAST_REST_MIN_S,
    THROTTLE_OFFICIAL_S,
    THROTTLE_UNOFFICIAL_MAX_S,
    THROTTLE_UNOFFICIAL_MIN_S,
    WARMUP_DAILY_CAPS,
    WARMUP_WINDOW_S,
)
from ..contracts.events import Media, OutboundCommand, Party, Template
from ..contracts.events import Type1 as OutboundType
from ..db import AsyncSessionLocal, engine
from ..models import Broadcast, BroadcastRecipient, Channel, Contact
from ..pipeline.flow_engine import render, start_broadcast_state
from ..repositories import broadcasts, channels, conversations, entitlements, messages
from . import warmup
from .inbound import _guess_mime

log = logging.getLogger("engine.broadcast")


async def run_broadcast(broadcast_id: uuid.UUID, tenant_id: uuid.UUID | None = None) -> dict:
    """Bangun recipients dari audience (partisi opt_in), set status running."""
    async with AsyncSessionLocal() as session, session.begin():
        b = await broadcasts.get(session, broadcast_id, lock=True)
        # Tenant scope (defense-in-depth): mismatch = tidak ada.
        if b is None or (tenant_id is not None and b.tenant_id != tenant_id):
            raise ValueError(f"broadcast {broadcast_id} tidak ada")
        if b.status not in ("draft", "scheduled"):
            return {"status": b.status, "skipped": True}

        # Blast HANYA WhatsApp. Messenger/Instagram: kebijakan Meta hanya izinkan
        # free-form dalam window 24 jam (no cold blast) + MessengerSender pakai
        # messaging_type RESPONSE → di luar window ditolak provider. Tolak tegas di
        # sini, jangan biarkan jadi antrean yang pasti gagal diam-diam.
        channel = await channels.get_by_id(session, b.channel_id)
        if channel is None or channel.type not in ("wa_official", "wa_unofficial"):
            raise ValueError(
                "Broadcast hanya didukung untuk channel WhatsApp. Messenger/Instagram "
                "tidak bisa blast (kebijakan Meta: hanya balasan dalam window 24 jam)."
            )

        if channel.tenant_id != b.tenant_id or channel.status != "connected":
            raise ValueError("Channel broadcast belum terhubung")
        if channel.type == "wa_official" and not b.template_id:
            raise ValueError("Broadcast WhatsApp official memerlukan template")
        if channel.type == "wa_unofficial" and not (b.body_snapshot or "").strip():
            raise ValueError("Isi broadcast tidak boleh kosong")

        contacts = await broadcasts.match_contacts(session, b.tenant_id, b.audience_filter)

        # Plan check when it actually starts: a scheduled broadcast must not go out
        # after a downgrade, nor push the tenant past its monthly recipient quota.
        plan = await entitlements.for_tenant(session, b.tenant_id)
        if not plan.features.get("broadcast", False):
            raise ValueError("Fitur Broadcast tidak termasuk paket tenant ini")
        if plan.broadcast_per_month is not None:
            await broadcasts.lock_tenant(session, b.tenant_id)
            audience = sum(1 for c in contacts if c.opt_in_status == "opted_in")
            left = max(plan.broadcast_per_month - await broadcasts.month_usage(session, b.tenant_id), 0)
            if audience > left:
                idr = lambda n: f"{n:,}".replace(",", ".")  # noqa: E731 — 12.500 (id-ID)
                raise ValueError(
                    f"Kuota broadcast bulan ini tidak cukup: sisa {idr(left)} penerima, "
                    f"broadcast ini {idr(audience)} penerima"
                )

        pending = skipped = 0
        for c in contacts:
            if c.opt_in_status == "opted_in":
                await broadcasts.add_recipient(
                    session, tenant_id=b.tenant_id, broadcast_id=b.id,
                    contact_id=c.id, status="pending",
                )
                pending += 1
            elif c.opt_in_status == "opted_out":
                await broadcasts.add_recipient(
                    session, tenant_id=b.tenant_id, broadcast_id=b.id,
                    contact_id=c.id, status="skipped_optout",
                )
                skipped += 1
            # unknown: dikecualikan (bukan consent)

        stats = {"total": pending, "sent": 0, "failed": 0, "skipped_optout": skipped}
        await broadcasts.set_status(session, b.id, "running", stats)
    return {"status": "running", "pending": pending, "skipped_optout": skipped}


def _throttle_seconds(channel: Channel | None) -> float:
    if channel is not None and channel.type == "wa_unofficial":
        return random.uniform(THROTTLE_UNOFFICIAL_MIN_S, THROTTLE_UNOFFICIAL_MAX_S)
    return THROTTLE_OFFICIAL_S


def _daily_cap(channel: Channel, now: datetime) -> int:
    """Cap outbound/rolling-24h sesuai umur channel (warmup). 0 = nonaktif.
    Sumber tunggal di services.warmup (dipakai broadcast + kirim 1:1)."""
    return warmup.daily_cap(channel, now)


def _param_value(spec: dict, contact: Contact) -> str:
    """Isi variabel template: nilai tetap, atau dari data kontak (dengan cadangan)."""
    source = spec.get("source", "static")
    if source == "contact_name":
        value = (contact.name or "").strip()
    elif source == "contact_phone":
        value = (contact.phone or "").strip()
    else:
        value = str(spec.get("value", ""))
    # Meta menolak parameter kosong → pakai cadangan.
    return value or str(spec.get("fallback") or "-")


def template_components(broadcast_id, params: dict, contact: Contact) -> list[dict]:
    """Snapshot broadcast.template_params → komponen template WA Cloud per penerima.

    params = {
      "header": {"format": "IMAGE"|"VIDEO"|"DOCUMENT"|"TEXT", "link": url, "text": [spec]},
      "body": [spec, ...],                       # urut {{1}}, {{2}}, ...
      "buttons": [{"index": 0, "type": "QUICK_REPLY"} | {"index": 1, "type": "URL", "param": spec}],
    }
    Tombol quick reply membawa payload "bc:<broadcast_id>:<index>" supaya klik bisa
    dilacak ke broadcast + tombolnya.
    """
    components: list[dict] = []
    header = params.get("header") or {}
    fmt = str(header.get("format") or "").upper()
    if fmt in ("IMAGE", "VIDEO", "DOCUMENT") and header.get("link"):
        kind = fmt.lower()
        media: dict = {"link": header["link"]}
        if kind == "document" and header.get("filename"):
            media["filename"] = header["filename"]
        components.append({"type": "header", "parameters": [{"type": kind, kind: media}]})
    elif fmt == "TEXT" and header.get("text"):
        components.append({
            "type": "header",
            "parameters": [{"type": "text", "text": _param_value(s, contact)} for s in header["text"]],
        })
    body = params.get("body") or []
    if body:
        components.append({
            "type": "body",
            "parameters": [{"type": "text", "text": _param_value(s, contact)} for s in body],
        })
    for btn in params.get("buttons") or []:
        idx = str(int(btn.get("index", 0)))
        if btn.get("type") == "QUICK_REPLY":
            components.append({
                "type": "button",
                "sub_type": "quick_reply",
                "index": idx,
                "parameters": [{"type": "payload", "payload": f"bc:{broadcast_id}:{idx}"}],
            })
        elif btn.get("type") == "URL" and btn.get("param"):
            components.append({
                "type": "button",
                "sub_type": "url",
                "index": idx,
                "parameters": [{"type": "text", "text": _param_value(btn["param"], contact)}],
            })
    return components


def _build_command(
    b: Broadcast, channel: Channel | None, contact: Contact, conv_id, idem: str
) -> OutboundCommand:
    use_template = channel is not None and channel.type == "wa_official" and b.template_id
    if use_template:
        return OutboundCommand(
            event_id=uuid.uuid4().hex,
            idempotency_key=idem,
            channel_id=b.channel_id,
            to=Party(external_id=contact.external_id or contact.phone or "", phone=contact.phone),
            type=OutboundType.template,
            template=Template(
                name=b.template_id,
                lang=b.template_lang or "id",
                components=template_components(b.id, b.template_params or {}, contact),
            ),
            conversation_id=conv_id,
        )
    media_url = _media_url(b)
    body = personal_body(b, contact)
    return OutboundCommand(
        event_id=uuid.uuid4().hex,
        idempotency_key=idem,
        channel_id=b.channel_id,
        to=Party(external_id=contact.external_id or contact.phone or "", phone=contact.phone),
        type=OutboundType.media if media_url else OutboundType.text,
        body=(body or None) if media_url else body,
        media=Media(url=media_url, mime=_guess_mime(media_url)) if media_url else None,
        conversation_id=conv_id,
    )


def _media_url(b: Broadcast) -> str | None:
    """Optional image for text broadcasts (WA unofficial), absolute for the gateway."""
    url = str((b.template_params or {}).get("media_url") or "").strip()
    if not url:
        return None
    return urljoin(APP_BASE_URL + "/", url)


def personal_body(b: Broadcast, contact: Contact) -> str:
    """Text broadcast with {{nama}} filled per recipient (flow broadcasts)."""
    body = b.body_snapshot or ""
    if not b.flow_id or b.template_id:
        return body
    return render(body, {"nama": (contact.name or "").strip() or "Kak"})


async def dispatch(
    broadcast_id: uuid.UUID, throttle_s: float | None = None, batch: int = BROADCAST_BATCH
) -> dict:
    # HTTP background tasks and the polling worker may pick the same broadcast.
    # Hold a session advisory lock across transaction boundaries and throttling.
    key = broadcast_id.int % (1 << 63)
    async with engine.connect() as connection:
        acquired = await connection.scalar(text("SELECT pg_try_advisory_lock(:key)"), {"key": key})
        if not acquired:
            return {"skipped": True}
        try:
            return await _dispatch_locked(broadcast_id, throttle_s, batch)
        finally:
            await connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})


async def _dispatch_locked(
    broadcast_id: uuid.UUID, throttle_s: float | None = None, batch: int = BROADCAST_BATCH
) -> dict:
    """Kirim semua penerima pending (throttle). Update status + stats. Idempoten per penerima."""
    sent = failed = skipped_optout = 0
    async with AsyncSessionLocal() as session:
        async with session.begin():
            b = await broadcasts.get(session, broadcast_id)
            if b is None or b.status != "running":
                return {"skipped": True}
            channel = await channels.get_by_id(session, b.channel_id)
        mtype = "template" if (channel and channel.type == "wa_official" and b.template_id) else "text"
        is_unofficial = channel is not None and channel.type == "wa_unofficial"

        # Warmup + daily cap (unofficial, throttle default). cap_remaining None =
        # tanpa batas. Saat habis → pause: sisakan recipient pending, status tetap
        # running; worker re-invoke dispatch tiap poll, lanjut saat window longgar.
        cap_remaining: int | None = None
        if is_unofficial and throttle_s is None:
            now = datetime.now(timezone.utc)
            cap = _daily_cap(channel, now)
            if cap > 0:
                async with session.begin():
                    used = await messages.count_outbound_since(
                        session, b.channel_id, now - timedelta(seconds=WARMUP_WINDOW_S)
                    )
                cap_remaining = max(0, cap - used)
                # sisa 0 = worker poll tiap 5s sampai window longgar → debug, jangan spam info.
                log.log(
                    logging.INFO if cap_remaining > 0 else logging.DEBUG,
                    "broadcast %s cap warmup: %d terpakai %d, sisa %d",
                    broadcast_id, cap, used, cap_remaining,
                )

        paused = False
        while True:
            async with session.begin():
                recips: list[BroadcastRecipient] = await broadcasts.pending_recipients(
                    session, broadcast_id, batch
                )
            if not recips:
                break

            for r in recips:
                if cap_remaining is not None and cap_remaining <= 0:
                    paused = True
                    break
                idem = f"bcast:{broadcast_id}:{r.contact_id}"
                try:
                    async with session.begin():
                        # Consent may have changed after the audience was built.
                        await session.refresh(r.contact)
                        if r.contact.opt_in_status != "opted_in":
                            r.status = "skipped_optout"
                            skipped_optout += 1
                            continue
                        if channel is None:
                            raise ValueError("Channel tidak ditemukan")
                        await session.refresh(channel)
                        if channel.status != "connected":
                            paused = True
                            break
                        conv = await conversations.get_or_create_active(
                            session, b.tenant_id, b.channel_id, r.contact_id
                        )
                        body = personal_body(b, r.contact)
                        media_url = _media_url(b) if mtype == "text" else None
                        msg = await messages.add_outbound(
                            session,
                            tenant_id=b.tenant_id,
                            conversation_id=conv.id,
                            channel_id=b.channel_id,
                            sender="system",
                            body=body,
                            idempotency_key=idem,
                            msg_type="image" if media_url else mtype,
                            media={"url": media_url} if media_url else None,
                        )
                        r.status = "sent"
                        r.message_id = msg.id
                        conv.last_message_at = datetime.now(timezone.utc)
                        conv.last_message_preview = (body or ("[foto]" if media_url else "[template]"))[:120]
                        if b.flow_id and b.flow_node_id:
                            # Reply / button tap continues the flow from this step.
                            await start_broadcast_state(session, conv, b, r.contact)
                        cmd = _build_command(b, channel, r.contact, conv.id, idem)
                    await publish_outbound(cmd.model_dump_json(by_alias=True))
                    sent += 1
                    if cap_remaining is not None:
                        cap_remaining -= 1
                except Exception as e:  # noqa: BLE001
                    log.exception("broadcast recipient gagal: %s", r.contact_id)
                    async with session.begin():
                        r.status = "failed"
                        r.error = str(e)[:500]
                    failed += 1

                delay = throttle_s if throttle_s is not None else _throttle_seconds(channel)
                if delay > 0:
                    await asyncio.sleep(delay)

                # Rest panjang anti-banned: tiap N pesan terkirim, jeda lama acak
                # meniru manusia istirahat (hanya unofficial, hanya saat memakai
                # throttle default — bukan override eksplisit dari pemanggil).
                if (
                    is_unofficial
                    and throttle_s is None
                    and BROADCAST_REST_EVERY > 0
                    and r.status == "sent"
                    and sent > 0
                    and sent % BROADCAST_REST_EVERY == 0
                ):
                    rest = random.uniform(BROADCAST_REST_MIN_S, BROADCAST_REST_MAX_S)
                    log.info("broadcast %s rest %.0fs setelah %d kirim", broadcast_id, rest, sent)
                    await asyncio.sleep(rest)

            if paused:
                break

        # Stats akumulatif lintas re-invoke (cap bisa pecah broadcast jadi
        # beberapa dispatch). Pause → status tetap running (worker lanjut nanti).
        prev = b.stats or {}
        stats = {
            "total": prev.get("total", sent + failed),
            "sent": prev.get("sent", 0) + sent,
            "failed": prev.get("failed", 0) + failed,
            "skipped_optout": prev.get("skipped_optout", 0) + skipped_optout,
        }
        status = "running" if paused else "done"
        async with session.begin():
            await broadcasts.set_status(session, broadcast_id, status, stats)
        if paused:
            log.info("broadcast %s pause (cap warmup tercapai), %d terkirim run ini", broadcast_id, sent)
    return {"status": status, "sent": sent, "failed": failed, "paused": paused}
