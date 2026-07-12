"""Seed data dev. Jalankan: make seed (atau python -m app.seed).

Buat 2 akun (idempoten):
  - admin platform (tenant_id NULL): admin@chatcepat.id / admin123
  - client tenant Demo:             client@chatcepat.id / client123
"""

from __future__ import annotations

import asyncio

import bcrypt
from sqlalchemy import select

from .db import AsyncSessionLocal, engine
from .models import Plan, Tenant, User

ADMIN_EMAIL = "admin@chatcepat.id"
ADMIN_PASSWORD = "admin123"
CLIENT_EMAIL = "client@chatcepat.id"
CLIENT_PASSWORD = "client123"

# Paket pricing (Basic/Pro/Enterprise). Batas fitur di-enforce web (lib/entitlements).
PLANS = [
    dict(
        tier="basic",
        name="Basic",
        slug="basic",
        price_idr=249000,
        quota=2000,
        highlight=False,
        sort_order=1,
        description="Untuk UMKM yang baru mulai omnichannel.",
        features=[
            "2 channel (WhatsApp + 1 sosial media)",
            "3 anggota tim",
            "Inbox terpadu + kontak & tag tanpa batas",
            "Broadcast WhatsApp 2.000 pesan/bulan",
            "AI Agent dasar (10 dokumen knowledge base)",
            "Template pesan",
        ],
    ),
    dict(
        tier="pro",
        name="Pro",
        slug="pro",
        price_idr=449000,
        quota=10000,
        highlight=True,
        sort_order=2,
        description="Untuk bisnis berkembang dengan tim.",
        features=[
            "5 channel (WA official & unofficial, Instagram, Facebook, Telegram)",
            "10 anggota tim",
            "Broadcast WhatsApp 10.000 pesan/bulan",
            "AI Agent penuh (100 dokumen) + auto-reply semua channel",
            "Otomasi / flow builder",
            "Katalog produk",
            "Analitik lanjutan",
        ],
    ),
    dict(
        tier="enterprise",
        name="Enterprise",
        slug="enterprise",
        price_idr=749000,
        quota=50000,
        highlight=False,
        sort_order=3,
        description="Untuk skala besar & multi-brand.",
        features=[
            "Channel & anggota tim tanpa batas",
            "Broadcast WhatsApp 50.000 pesan/bulan",
            "AI Agent knowledge base tanpa batas",
            "Multi-nomor WhatsApp + rotasi",
            "Peran & izin lanjutan",
            "Support prioritas + SLA + onboarding",
        ],
    ),
]


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def _seed_plans(session) -> None:
    """Upsert paket by slug (idempoten + refresh harga/fitur saat re-seed)."""
    for p in PLANS:
        existing = await session.scalar(select(Plan).where(Plan.slug == p["slug"]))
        if existing is None:
            session.add(Plan(period="month", is_active=True, **p))
            print(f"seed: plan {p['name']} dibuat")
        else:
            for k, v in p.items():
                setattr(existing, k, v)
            print(f"seed: plan {p['name']} diperbarui")


async def run() -> None:
    async with AsyncSessionLocal() as session, session.begin():
        # Admin platform (tanpa tenant) — god-mode.
        if await session.scalar(select(User).where(User.email == ADMIN_EMAIL)) is None:
            session.add(
                User(
                    tenant_id=None,
                    name="Admin Platform",
                    email=ADMIN_EMAIL,
                    password_hash=_hash(ADMIN_PASSWORD),
                    role="admin",
                    status="active",
                )
            )
            print(f"seed: admin platform {ADMIN_EMAIL} (password: {ADMIN_PASSWORD})")
        else:
            print(f"seed: admin {ADMIN_EMAIL} sudah ada — skip")

        # Client tenant Demo.
        if await session.scalar(select(User).where(User.email == CLIENT_EMAIL)) is None:
            tenant = await session.scalar(select(Tenant).where(Tenant.slug == "demo"))
            if tenant is None:
                tenant = Tenant(name="Demo", slug="demo", plan="pro", status="active")
                session.add(tenant)
                await session.flush()
            session.add(
                User(
                    tenant_id=tenant.id,
                    name="Client Demo",
                    email=CLIENT_EMAIL,
                    password_hash=_hash(CLIENT_PASSWORD),
                    role="client",
                    status="active",
                )
            )
            print(f"seed: client tenant Demo {CLIENT_EMAIL} (password: {CLIENT_PASSWORD})")
        else:
            print(f"seed: client {CLIENT_EMAIL} sudah ada — skip")

        await _seed_plans(session)


async def _main() -> None:
    await run()
    await engine.dispose()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
