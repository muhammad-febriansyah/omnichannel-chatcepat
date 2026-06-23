// RBAC — role flat + matriks ability (docs/prd/03).
// MIRROR dari engine/app/rbac.py — JAGA SINKRON. Penegakan WAJIB server-side
// (Server Action / Route Handler); UI hide/disable hanya kosmetik.

// Cuma 2 role:
//   admin  = operator platform (god-mode, tanpa tenant). Kelola paket + semua tenant.
//   client = akun tenant pelanggan. Akses penuh ke workspace-nya sendiri.
export type Role = "admin" | "client";

export type Ability =
  | "tenant.manage"
  | "platform.monitor"
  | "channel.connect"
  | "channel.view"
  | "flow.manage"
  | "knowledge.manage"
  | "product.manage"
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
  // admin = platform: god-mode (can() short-circuit true). Set = ability platform.
  admin: new Set<Ability>([
    "tenant.manage",
    "platform.monitor",
    "channel.connect",
    "channel.view",
    "report.view",
    "audit.view",
  ]),
  // client = tenant: akses penuh workspace sendiri.
  client: new Set<Ability>([
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
  ]),
};

export interface SessionUser {
  id: string;
  role: Role;
  tenantId: string | null;
}

export function can(user: Pick<SessionUser, "role"> | null, ability: Ability): boolean {
  if (!user) return false;
  if (user.role === "admin") return true; // god-mode platform: akses semua fitur
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

/** client lihat semua percakapan dalam tenant-nya (akses penuh). */
export function canViewAllConversations(user: Pick<SessionUser, "role"> | null): boolean {
  return can(user, "conversation.view_all");
}
