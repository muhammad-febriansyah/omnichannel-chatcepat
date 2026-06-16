"""RBAC — role flat + matriks ability (docs/prd/03).

Sumber kebenaran matriks (engine). Mirror di web: `web/lib/rbac.ts` — JAGA SINKRON.
Penegakan WAJIB server-side; UI hide/disable hanya kosmetik.
"""

from __future__ import annotations

# Role (users.role enum)
SUPER_ADMIN = "super_admin"
ADMIN = "admin"
SUPERVISOR = "supervisor"
AGENT = "agent"

# Ability
ALL_ABILITIES: frozenset[str] = frozenset(
    {
        "tenant.manage",
        "platform.monitor",
        "channel.connect",
        "channel.view",
        "flow.manage",
        "knowledge.manage",
        "user.manage",
        "billing.tenant",
        "contact.manage",
        "contact.view",
        "broadcast.manage",
        "conversation.assign",
        "conversation.view_all",
        "conversation.view_assigned",
        "conversation.takeover",
        "report.view",
        "audit.view",
    }
)

ROLE_ABILITIES: dict[str, frozenset[str]] = {
    SUPER_ADMIN: frozenset(
        {
            "tenant.manage",
            "platform.monitor",
            "channel.connect",
            "channel.view",
            "report.view",
            "audit.view",
        }
    ),
    ADMIN: frozenset(
        {
            "channel.connect",
            "channel.view",
            "flow.manage",
            "knowledge.manage",
            "user.manage",
            "billing.tenant",
            "contact.manage",
            "contact.view",
            "broadcast.manage",
            "conversation.assign",
            "conversation.view_all",
            "conversation.view_assigned",
            "conversation.takeover",
            "report.view",
            "audit.view",
        }
    ),
    SUPERVISOR: frozenset(
        {
            "channel.view",
            "contact.manage",
            "contact.view",
            "broadcast.manage",
            "conversation.assign",
            "conversation.view_all",
            "conversation.view_assigned",
            "conversation.takeover",
            "report.view",
        }
    ),
    AGENT: frozenset(
        {
            "contact.view",
            "conversation.view_assigned",
            "conversation.takeover",
        }
    ),
}


class PermissionDenied(Exception):
    def __init__(self, role: str, ability: str) -> None:
        super().__init__(f"role '{role}' tidak punya ability '{ability}'")
        self.role = role
        self.ability = ability


def can(role: str | None, ability: str) -> bool:
    return ability in ROLE_ABILITIES.get(role or "", frozenset())


def require(role: str | None, ability: str) -> None:
    if not can(role, ability):
        raise PermissionDenied(role or "", ability)


def can_view_all_conversations(role: str | None) -> bool:
    """Agent hanya lihat percakapan yang di-assign; role lain lihat semua (dalam tenant)."""
    return can(role, "conversation.view_all")
