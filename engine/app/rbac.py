"""RBAC — role flat + matriks ability (docs/prd/03).

Sumber kebenaran matriks (engine). Mirror di web: `web/lib/rbac.ts` — JAGA SINKRON.
Penegakan WAJIB server-side; UI hide/disable hanya kosmetik.
"""

from __future__ import annotations

# Role (users.role enum). Cuma 2:
#   admin  = operator platform (god-mode, tenant_id NULL). Kelola paket + semua tenant.
#   client = akun tenant pelanggan. Akses penuh ke workspace-nya sendiri.
ADMIN = "admin"
CLIENT = "client"

# Ability
ALL_ABILITIES: frozenset[str] = frozenset(
    {
        "tenant.manage",
        "platform.monitor",
        "channel.connect",
        "channel.view",
        "flow.manage",
        "knowledge.manage",
        "product.manage",
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
    # admin = platform: god-mode (can() short-circuit true). Matriks = ability platform.
    ADMIN: frozenset(
        {
            "tenant.manage",
            "platform.monitor",
            "channel.connect",
            "channel.view",
            "report.view",
            "audit.view",
        }
    ),
    # client = tenant: akses penuh workspace sendiri.
    CLIENT: frozenset(
        {
            "channel.connect",
            "channel.view",
            "flow.manage",
            "knowledge.manage",
            "product.manage",
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
}


class PermissionDenied(Exception):
    def __init__(self, role: str, ability: str) -> None:
        super().__init__(f"role '{role}' tidak punya ability '{ability}'")
        self.role = role
        self.ability = ability


def can(role: str | None, ability: str) -> bool:
    if role == ADMIN:
        return True  # god-mode platform: akses semua ability (impersonasi tenant)
    return ability in ROLE_ABILITIES.get(role or "", frozenset())


def require(role: str | None, ability: str) -> None:
    if not can(role, ability):
        raise PermissionDenied(role or "", ability)


def can_view_all_conversations(role: str | None) -> bool:
    """client lihat semua percakapan dalam tenant-nya (akses penuh)."""
    return can(role, "conversation.view_all")
