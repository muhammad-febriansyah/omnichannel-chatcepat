"""Test matriks RBAC (docs/prd/03). Authoritative — web/lib/rbac.ts harus sama."""

import pytest

from app.rbac import (
    ADMIN,
    AGENT,
    SUPER_ADMIN,
    SUPERVISOR,
    PermissionDenied,
    can,
    can_view_all_conversations,
    require,
)

# (ability, role, expected) — sel kunci dari tabel PRD 03.
CASES = [
    ("tenant.manage", SUPER_ADMIN, True),
    ("tenant.manage", ADMIN, False),
    ("platform.monitor", SUPER_ADMIN, True),
    ("channel.connect", ADMIN, True),
    ("channel.connect", SUPERVISOR, False),
    ("channel.view", SUPERVISOR, True),
    ("channel.view", AGENT, False),
    ("flow.manage", ADMIN, True),
    ("flow.manage", SUPERVISOR, False),
    ("knowledge.manage", ADMIN, True),
    ("user.manage", ADMIN, True),
    ("user.manage", SUPERVISOR, False),
    ("billing.tenant", ADMIN, True),
    ("contact.manage", SUPERVISOR, True),
    ("contact.manage", AGENT, False),
    ("contact.view", AGENT, True),
    ("broadcast.manage", SUPERVISOR, True),
    ("broadcast.manage", AGENT, False),
    ("conversation.assign", SUPERVISOR, True),
    ("conversation.assign", AGENT, False),
    ("conversation.view_all", SUPERVISOR, True),
    ("conversation.view_all", AGENT, False),
    ("conversation.view_assigned", AGENT, True),
    ("conversation.takeover", AGENT, True),
    ("report.view", SUPER_ADMIN, True),
    ("report.view", AGENT, False),
    ("audit.view", ADMIN, True),
    ("audit.view", SUPERVISOR, False),
    # super_admin = platform; TIDAK punya ability operasional tenant
    ("broadcast.manage", SUPER_ADMIN, False),
    ("contact.view", SUPER_ADMIN, False),
    ("flow.manage", SUPER_ADMIN, False),
]


@pytest.mark.parametrize("ability,role,expected", CASES)
def test_matrix(ability, role, expected):
    assert can(role, ability) is expected


def test_require_raises():
    require(ADMIN, "broadcast.manage")  # tidak raise
    with pytest.raises(PermissionDenied):
        require(AGENT, "broadcast.manage")


def test_unknown_role_and_ability():
    assert can(None, "contact.view") is False
    assert can("ghost", "contact.view") is False
    assert can(ADMIN, "does.not.exist") is False


def test_conversation_visibility():
    assert can_view_all_conversations(ADMIN) is True
    assert can_view_all_conversations(SUPERVISOR) is True
    assert can_view_all_conversations(AGENT) is False
