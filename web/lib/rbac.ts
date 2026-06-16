// RBAC — role flat + matriks ability (docs/prd/03).
// MIRROR dari engine/app/rbac.py — JAGA SINKRON. Penegakan WAJIB server-side
// (Server Action / Route Handler); UI hide/disable hanya kosmetik.

export type Role = "super_admin" | "admin" | "supervisor" | "agent";

export type Ability =
  | "tenant.manage"
  | "platform.monitor"
  | "channel.connect"
  | "channel.view"
  | "flow.manage"
  | "knowledge.manage"
  | "user.manage"
  | "billing.tenant"
  | "contact.manage"
  | "contact.view"
  | "broadcast.manage"
  | "conversation.assign"
  | "conversation.view_all"
  | "conversation.view_assigned"
  | "conversation.takeover"
  | "report.view"
  | "audit.view";

export const ROLE_ABILITIES: Record<Role, ReadonlySet<Ability>> = {
  super_admin: new Set<Ability>([
    "tenant.manage",
    "platform.monitor",
    "channel.connect",
    "channel.view",
    "report.view",
    "audit.view",
  ]),
  admin: new Set<Ability>([
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
  ]),
  supervisor: new Set<Ability>([
    "channel.view",
    "contact.manage",
    "contact.view",
    "broadcast.manage",
    "conversation.assign",
    "conversation.view_all",
    "conversation.view_assigned",
    "conversation.takeover",
    "report.view",
  ]),
  agent: new Set<Ability>([
    "contact.view",
    "conversation.view_assigned",
    "conversation.takeover",
  ]),
};

export interface SessionUser {
  id: string;
  role: Role;
  tenantId: string | null;
}

export function can(user: Pick<SessionUser, "role"> | null, ability: Ability): boolean {
  if (!user) return false;
  return ROLE_ABILITIES[user.role]?.has(ability) ?? false;
}

export class PermissionError extends Error {
  constructor(
    public role: string,
    public ability: Ability,
  ) {
    super(`role '${role}' tidak punya ability '${ability}'`);
    this.name = "PermissionError";
  }
}

/** Pakai di awal tiap Server Action / Route Handler yang butuh ability. */
export function requireAbility(user: SessionUser | null, ability: Ability): void {
  if (!can(user, ability)) {
    throw new PermissionError(user?.role ?? "anon", ability);
  }
}

/** Agent hanya lihat percakapan yang di-assign; role lain lihat semua (dalam tenant). */
export function canViewAllConversations(user: Pick<SessionUser, "role"> | null): boolean {
  return can(user, "conversation.view_all");
}
