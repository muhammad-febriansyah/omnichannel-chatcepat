"""Mailketing transactional email adapter and ChatCepat email templates."""

from __future__ import annotations

import html
import logging
from collections.abc import Sequence
from datetime import datetime

import httpx

from ..config import (
    APP_BASE_URL,
    MAILKETING_API_TOKEN,
    MAILKETING_API_URL,
    MAILKETING_FROM_EMAIL,
    MAILKETING_FROM_NAME,
    MAILKETING_LOGO_URL,
)

log = logging.getLogger("engine.mailketing")

ID_MONTHS = (
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
)


class MailketingError(RuntimeError):
    pass


def configured() -> bool:
    return bool(MAILKETING_API_TOKEN.strip() and MAILKETING_FROM_EMAIL.strip())


def _date_id(value: datetime) -> str:
    return f"{value.day} {ID_MONTHS[value.month - 1]} {value.year}"


def _url(path: str) -> str:
    return f"{APP_BASE_URL}{path}"


def _render_email(
    *,
    preheader: str,
    title: str,
    greeting: str,
    paragraphs: Sequence[str],
    detail_label: str | None = None,
    detail_value: str | None = None,
    cta_label: str,
    cta_url: str,
    footer_note: str,
) -> str:
    logo_url = MAILKETING_LOGO_URL.strip() or _url("/logo.png")
    body = "".join(f'<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7">{html.escape(p)}</p>' for p in paragraphs)
    detail = ""
    if detail_label and detail_value:
        detail = f"""
        <div style="margin:24px 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
          <div style="color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">{html.escape(detail_label)}</div>
          <div style="margin-top:6px;color:#172554;font-size:18px;font-weight:700">{html.escape(detail_value)}</div>
        </div>
        """
    return f"""<!doctype html>
<html lang="id">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#172554">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">{html.escape(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden">
          <tr><td style="padding:25px 32px;background:#1e2a78">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td><img src="{html.escape(logo_url, quote=True)}" width="150" alt="ChatCepat" style="display:block;max-width:150px;height:auto" /></td>
              <td align="right" style="color:#bfdbfe;font-size:12px;font-weight:700">OMNICHANNEL AI</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:36px 32px 28px">
            <div style="color:#3b82f6;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">ChatCepat</div>
            <h1 style="margin:10px 0 18px;color:#172554;font-size:28px;line-height:1.2">{html.escape(title)}</h1>
            <p style="margin:0 0 18px;color:#172554;font-size:16px;line-height:1.6">Halo {html.escape(greeting)},</p>
            {body}
            {detail}
            <a href="{html.escape(cta_url, quote=True)}" style="display:inline-block;margin-top:6px;padding:13px 21px;border-radius:10px;background:#3b82f6;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">{html.escape(cta_label)}</a>
            <p style="margin:25px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">Jika tombol tidak bisa dibuka, salin alamat halaman dari browser dan buka {html.escape(cta_url)}</p>
          </td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6">
            <strong style="color:#172554">ChatCepat</strong><br />
            {html.escape(footer_note)}<br />
            Email ini dikirim otomatis. Mohon tidak membalas email ini.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


async def send_email(*, recipient: str, subject: str, content: str) -> None:
    if not configured():
        raise MailketingError("Mailketing belum dikonfigurasi")

    payload = {
        "api_token": MAILKETING_API_TOKEN,
        "from_name": MAILKETING_FROM_NAME,
        "from_email": MAILKETING_FROM_EMAIL,
        "recipient": recipient,
        "subject": subject,
        "content": content,
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(MAILKETING_API_URL, data=payload)
    except httpx.HTTPError as exc:
        raise MailketingError("Mailketing tidak dapat dihubungi") from exc

    try:
        data = response.json()
    except ValueError:
        data = {}
    provider_status = str(data.get("status", "")).lower()
    if response.status_code >= 400 or provider_status != "success":
        reason = str(data.get("response") or f"HTTP {response.status_code}")
        raise MailketingError(f"Mailketing menolak email: {reason[:180]}")


def welcome_email(*, name: str, business: str) -> tuple[str, str]:
    return (
        "Selamat datang di ChatCepat",
        _render_email(
            preheader="Akun bisnis Anda sudah siap digunakan di ChatCepat.",
            title="Selamat datang di ChatCepat",
            greeting=name,
            paragraphs=(
                f"Akun untuk {business} sudah berhasil dibuat.",
                "Satukan percakapan pelanggan, kelola tim, dan bantu bisnis Anda merespons lebih cepat dari satu inbox.",
            ),
            cta_label="Buka Dashboard",
            cta_url=_url("/dashboard"),
            footer_note="Kelola percakapan pelanggan dengan lebih rapi dari satu tempat.",
        ),
    )


def plan_expiry_3d_email(*, name: str, expires_at: datetime) -> tuple[str, str]:
    expiry = _date_id(expires_at)
    return (
        "Paket ChatCepat Anda akan segera habis",
        _render_email(
            preheader=f"Paket Anda akan berakhir pada {expiry}. Perpanjang agar layanan tetap berjalan.",
            title="Paket Anda akan segera habis",
            greeting=name,
            paragraphs=(
                "Paket ChatCepat Anda akan berakhir dalam 3 hari.",
                "Perpanjang sekarang agar akses fitur dan pengelolaan channel tetap berjalan tanpa jeda.",
            ),
            detail_label="Tanggal berakhir",
            detail_value=expiry,
            cta_label="Perpanjang Paket",
            cta_url=_url("/billing"),
            footer_note="Kami mengingatkan Anda lebih awal agar operasional tidak terhenti.",
        ),
    )


def plan_expired_email(*, name: str, expires_at: datetime) -> tuple[str, str]:
    expiry = _date_id(expires_at)
    return (
        "Paket ChatCepat Anda telah habis",
        _render_email(
            preheader="Paket Anda telah berakhir. Perpanjang untuk mengaktifkan kembali layanan.",
            title="Paket Anda telah habis",
            greeting=name,
            paragraphs=(
                f"Paket ChatCepat Anda berakhir pada {expiry}.",
                "Segera perpanjang paket untuk mengaktifkan kembali akses layanan dan menjaga operasional channel Anda.",
            ),
            detail_label="Berakhir pada",
            detail_value=expiry,
            cta_label="Aktifkan Kembali Paket",
            cta_url=_url("/billing"),
            footer_note="Perpanjang paket kapan saja dari halaman Billing ChatCepat.",
        ),
    )
