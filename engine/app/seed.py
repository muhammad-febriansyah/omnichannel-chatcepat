"""Seed data dev. Jalankan: make seed (atau python -m app.seed).

Buat tenant Demo + admin user (idempoten). Login web: admin@chatcepat.com / admin123.
"""

from __future__ import annotations

import asyncio

import bcrypt
from sqlalchemy import select

from .db import AsyncSessionLocal, engine
from .models import Tenant, User

ADMIN_EMAIL = "admin@chatcepat.com"
ADMIN_PASSWORD = "admin123"


async def run() -> None:
    async with AsyncSessionLocal() as session, session.begin():
        existing = await session.scalar(select(User).where(User.email == ADMIN_EMAIL))
        if existing is not None:
            print(f"seed: admin {ADMIN_EMAIL} sudah ada — skip")
            return

        tenant = await session.scalar(select(Tenant).where(Tenant.slug == "demo"))
        if tenant is None:
            tenant = Tenant(name="Demo", slug="demo", plan="pro", status="active")
            session.add(tenant)
            await session.flush()

        pw_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        session.add(
            User(
                tenant_id=tenant.id,
                name="Admin Demo",
                email=ADMIN_EMAIL,
                password_hash=pw_hash,
                role="admin",
                status="active",
            )
        )
        print(f"seed: tenant Demo + admin {ADMIN_EMAIL} (password: {ADMIN_PASSWORD})")


async def _main() -> None:
    await run()
    await engine.dispose()


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
