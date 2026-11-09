"""Create (or reset) one client account from the command line.

The password is asked interactively (hidden input) so it never lands in code,
shell history or `docker inspect`. Use it on a server instead of app.seed, which
contains fixed demo passwords and must not run in production.

    docker exec -it chatcepat-engine-1 python -m app.create_user \
        --email reviewer@chatcepat.id --name "Meta Reviewer" --workspace "Meta Review" --plan pro

--reset-password  sets a new password for an existing account (nothing else changes).
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import re
import sys

import bcrypt
from sqlalchemy import select

from .db import AsyncSessionLocal, engine
from .models import Tenant, User

PLANS = ("basic", "pro", "business", "enterprise")
MIN_PASSWORD = 12


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "workspace"


def _ask_password() -> str:
    pw = getpass.getpass("Password baru: ")
    if len(pw) < MIN_PASSWORD:
        sys.exit(f"Password minimal {MIN_PASSWORD} karakter.")
    if getpass.getpass("Ulangi password: ") != pw:
        sys.exit("Password tidak sama.")
    return pw


async def _run(args: argparse.Namespace) -> None:
    email = args.email.strip().lower()
    async with AsyncSessionLocal() as session, session.begin():
        user = await session.scalar(select(User).where(User.email == email))

        if args.reset_password:
            if user is None:
                sys.exit(f"Akun {email} tidak ditemukan.")
            user.password_hash = bcrypt.hashpw(_ask_password().encode(), bcrypt.gensalt()).decode()
            print(f"Password {email} diperbarui.")
            return

        if user is not None:
            sys.exit(f"Akun {email} sudah ada. Pakai --reset-password untuk mengganti password.")

        password = _ask_password()
        base = _slug(args.workspace)
        slug, i = base, 1
        while await session.scalar(select(Tenant.id).where(Tenant.slug == slug)) is not None:
            i += 1
            slug = f"{base}-{i}"

        # plan_expires_at NULL = no expiry, so the account does not fall back to Basic.
        tenant = Tenant(name=args.workspace, slug=slug, plan=args.plan, status="active", plan_expires_at=None)
        session.add(tenant)
        await session.flush()
        session.add(
            User(
                tenant_id=tenant.id,
                name=args.name,
                email=email,
                password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
                role="client",
                status="active",
            )
        )
        print(f"Akun {email} dibuat: workspace '{args.workspace}' ({slug}), paket {args.plan}.")


def main() -> None:
    p = argparse.ArgumentParser(description="Buat akun klien ChatCepat (password ditanya, tidak disimpan di perintah).")
    p.add_argument("--email", required=True)
    p.add_argument("--name", default="Meta Reviewer")
    p.add_argument("--workspace", default="Meta Review")
    p.add_argument("--plan", choices=PLANS, default="pro")
    p.add_argument("--reset-password", action="store_true")
    args = p.parse_args()

    async def go() -> None:
        try:
            await _run(args)
        finally:
            await engine.dispose()

    asyncio.run(go())


if __name__ == "__main__":
    main()
