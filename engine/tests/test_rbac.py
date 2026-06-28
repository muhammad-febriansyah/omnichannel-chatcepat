"""Test matriks RBAC (docs/prd/03). Authoritative — web/lib/rbac.ts harus sama.

Model flat 2 role (migration 0006_roles_2):
  admin  = operator platform, god-mode → can() True untuk ability apa pun.
  client = akun tenant, akses penuh workspace sendiri (set ability eksplisit).
"""

import pytest

from app.rbac import (
    ADMIN,
    CLIENT,
    PermissionDenied,
    can,
    can_view_all_conversations,
    require,
)

# (ability, role, expected) — sel kunci dari matriks rbac.py.
CASES = [
    # admin = platform god-mode: True untuk SEMUA ability (short-circuit can()),
    # termasuk ability operasional tenant (impersonasi).
    ("tenant.manage", ADMIN, True),
    ("platform.monitor", ADMIN, True),
    ("channel.connect", ADMIN, True),
    ("broadcast.manage", ADMIN, True),
    ("contact.view", ADMIN, True),
    ("flow.manage", ADMIN, True),
    # client = tenant: akses penuh workspace sendiri.
    ("channel.connect", CLIENT, True),
    ("channel.view", CLIENT, True),
    ("flow.manage", CLIENT, True),
    ("knowledge.manage", CLIENT, True),
    ("product.manage", CLIENT, True),
    ("user.manage", CLIENT, True),
    ("billing.tenant", CLIENT, True),
    ("contact.manage", CLIENT, True),
    ("contact.view", CLIENT, True),
    ("broadcast.manage", CLIENT, True),
    ("conversation.assign", CLIENT, True),
    ("conversation.view_all", CLIENT, True),
    ("conversation.view_assigned", CLIENT, True),
    ("conversation.takeover", CLIENT, True),
    ("report.view", CLIENT, True),
    ("audit.view", CLIENT, True),
    # client TIDAK punya ability khusus platform.
    ("tenant.manage", CLIENT, False),
    ("platform.monitor", CLIENT, False),
]


@pytest.mark.parametrize("ability,role,expected", CASES)
def test_matrix(ability, role, expected):
    assert can(role, ability) is expected


def test_require_raises():
    require(ADMIN, "broadcast.manage")  # god-mode, tidak raise
    require(CLIENT, "broadcast.manage")  # client punya, tidak raise
    with pytest.raises(PermissionDenied):
        require(CLIENT, "tenant.manage")  # client tak punya ability platform


def test_unknown_role_and_ability():
    assert can(None, "contact.view") is False
    assert can("ghost", "contact.view") is False
    # client (bukan god-mode) → ability tak dikenal = False.
    assert can(CLIENT, "does.not.exist") is False
    # admin = god-mode → True bahkan untuk ability tak dikenal.
    assert can(ADMIN, "does.not.exist") is True


def test_conversation_visibility():
    # Keduanya lihat semua percakapan dalam scope-nya: admin god-mode, client
    # punya conversation.view_all. Hanya role tak dikenal yang False.
    assert can_view_all_conversations(ADMIN) is True
    assert can_view_all_conversations(CLIENT) is True
    assert can_view_all_conversations(None) is False
