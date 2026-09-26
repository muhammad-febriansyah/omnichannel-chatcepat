from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app import db
from app.api import internal
from app.services import mailketing


@pytest.mark.asyncio
async def test_reset_notification_uses_active_user_email_and_requires_service_token(monkeypatch):
    user = SimpleNamespace(status="active", name="<Alice>", email="alice@example.test")
    session = AsyncMock()
    session.get.return_value = user
    context = AsyncMock()
    context.__aenter__.return_value = session
    monkeypatch.setattr(db, "AsyncSessionLocal", lambda: context)
    monkeypatch.setattr(internal, "SERVICE_TOKEN", "test-service-token")
    send = AsyncMock()
    monkeypatch.setattr(mailketing, "send_email", send)
    payload = internal.PasswordResetNotificationIn(user_id=uuid4(), token="a" * 64)
    with pytest.raises(HTTPException) as error:
        await internal.notification_password_reset(payload, None)
    assert error.value.status_code == 401
    send.assert_not_called()
    assert await internal.notification_password_reset(payload, "test-service-token") == {"sent": True}
    assert send.call_args.kwargs["recipient"] == user.email
    assert "/reset-password?token=" + payload.token in send.call_args.kwargs["content"]
    assert "<Alice>" not in send.call_args.kwargs["content"]
    send.reset_mock()
    user.status = "disabled"
    assert await internal.notification_password_reset(payload, "test-service-token") == {"sent": False}
    send.assert_not_called()


@pytest.mark.asyncio
async def test_reset_notification_reports_provider_failure(monkeypatch):
    session = AsyncMock()
    session.get.return_value = SimpleNamespace(status="active", name="Alice", email="alice@example.test")
    context = AsyncMock()
    context.__aenter__.return_value = session
    monkeypatch.setattr(db, "AsyncSessionLocal", lambda: context)
    monkeypatch.setattr(internal, "SERVICE_TOKEN", "test-service-token")
    monkeypatch.setattr(mailketing, "send_email", AsyncMock(side_effect=mailketing.MailketingError("unavailable")))
    payload = internal.PasswordResetNotificationIn(user_id=uuid4(), token="b" * 64)
    with pytest.raises(HTTPException) as error:
        await internal.notification_password_reset(payload, "test-service-token")
    assert error.value.status_code == 503
