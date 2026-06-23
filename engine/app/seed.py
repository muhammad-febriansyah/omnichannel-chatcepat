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
from .models import Tenant, User

ADMIN_EMAIL = "admin@chatcepat.id"
ADMIN_PASSWORD = "admin123"
CLIENT_EMAIL = "client@chatcepat.id"
CLIENT_PASSWORD = "client123"


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


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


async def _main() -> None:
    await run()
    await engine.dispose()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
