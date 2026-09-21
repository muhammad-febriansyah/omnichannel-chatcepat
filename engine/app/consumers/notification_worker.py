"""Periodic Mailketing worker for subscription notifications."""

from __future__ import annotations

import asyncio
import logging

from ..config import NOTIFICATION_WORKER_INTERVAL_S
from ..services.notifications import send_plan_expiry_notifications

log = logging.getLogger("engine.notification.worker")


async def run() -> None:
    log.info("notification worker mulai interval=%ss", NOTIFICATION_WORKER_INTERVAL_S)
    while True:
        try:
            sent = await send_plan_expiry_notifications()
            if sent:
                log.info("subscription notification emails sent=%s", sent)
        except Exception:
            log.exception("notification worker tick gagal")
        await asyncio.sleep(max(60, NOTIFICATION_WORKER_INTERVAL_S))


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())


if __name__ == "__main__":
    main()
