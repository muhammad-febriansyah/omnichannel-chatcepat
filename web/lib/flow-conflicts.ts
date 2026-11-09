// "One account, one flow per trigger": two ACTIVE flows may not answer the same
// message on the same account. Pure module — used by saveFlow (server, blocking),
// the save dialog and the trigger's account picker, and by tests.

export type TriggerKindLike = "keyword" | "button" | "welcome" | "fallback" | "comment" | "broadcast";

export type FlowTriggerInfo = {
  id: string;
  name: string;
  kind: TriggerKindLike;
  channels: string[]; // empty = every account
  keywords: string[]; // keyword/button/comment match words (lowercased)
  posts: string[]; // comment trigger: limited to these posts (empty = all posts)
};

export type FlowConflict = { flowId: string; flowName: string; account: string; reason: string };

const KIND_LABEL: Record<TriggerKindLike, string> = {
  keyword: "Keyword",
  button: "Klik tombol",
  welcome: "Awal percakapan",
  fallback: "Cadangan",
  comment: "Komentar FB/IG",
  broadcast: "Broadcast",
};

export const triggerLabel = (k: TriggerKindLike) => KIND_LABEL[k] ?? k;

const norm = (xs: unknown): string[] =>
  (Array.isArray(xs) ? xs : []).filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter(Boolean);

/** Trigger info from a stored flow definition (runtime trigger node). */
export function triggerInfo(flow: { id: string; name: string; trigger: string; definition: unknown }): FlowTriggerInfo {
  const nodes = ((flow.definition as { nodes?: unknown[] } | null)?.nodes ?? []) as {
    type?: string;
    trigger?: { kind?: string; match?: unknown; channels?: unknown; posts?: unknown };
  }[];
  const t = nodes.find((n) => n?.type === "trigger")?.trigger ?? {};
  return {
    id: flow.id,
    name: flow.name,
    kind: (t.kind ?? flow.trigger) as TriggerKindLike,
    channels: (Array.isArray(t.channels) ? t.channels : []).map(String),
    keywords: norm(t.match),
    posts: (Array.isArray(t.posts) ? t.posts : []).map(String),
  };
}

/** Accounts both flows run on; null = no overlap. "*" = every account. */
function sharedAccounts(a: string[], b: string[]): string[] | null {
  if (!a.length && !b.length) return ["*"];
  if (!a.length) return b;
  if (!b.length) return a;
  const both = a.filter((x) => b.includes(x));
  return both.length ? both : null;
}

/** Why `other` would answer the same messages as `mine`, or null. */
function clashReason(mine: FlowTriggerInfo, other: FlowTriggerInfo): string | null {
  if (mine.kind !== other.kind || mine.kind === "broadcast") return null;
  if (mine.kind === "welcome" || mine.kind === "fallback") return `pemicu ${triggerLabel(mine.kind)} juga`;
  if (mine.kind === "comment") {
    const postsOverlap = !mine.posts.length || !other.posts.length || mine.posts.some((p) => other.posts.includes(p));
    if (!postsOverlap) return null;
    if (!mine.keywords.length && !other.keywords.length) return "juga membalas semua komentar";
    const same = mine.keywords.filter((k) => other.keywords.includes(k));
    return same.length ? `kata kunci komentar sama: ${same.join(", ")}` : null;
  }
  const same = mine.keywords.filter((k) => other.keywords.includes(k));
  if (!same.length) return null;
  return `${mine.kind === "button" ? "tombol" : "keyword"} sama: ${same.join(", ")}`;
}

/** Conflicts of `mine` with the other ACTIVE flows (pass only active ones). */
export function findFlowConflicts(
  mine: FlowTriggerInfo,
  others: FlowTriggerInfo[],
  accountName: (id: string) => string,
): FlowConflict[] {
  const out: FlowConflict[] = [];
  for (const other of others) {
    if (other.id === mine.id) continue;
    const reason = clashReason(mine, other);
    if (!reason) continue;
    const shared = sharedAccounts(mine.channels, other.channels);
    if (!shared) continue;
    const account = shared[0] === "*" ? "semua akun" : shared.map(accountName).join(", ");
    out.push({ flowId: other.id, flowName: other.name, account, reason });
  }
  return out;
}

export function conflictMessage(c: FlowConflict): string {
  return `Akun ${c.account} sudah dipakai flow "${c.flowName}" (${c.reason}). Satu akun hanya boleh punya satu flow untuk pemicu ini — pilih akun lain, atau nonaktifkan flow itu dulu.`;
}

/**
 * Accounts already taken for a catch-all trigger (welcome / fallback): which flow holds
 * each account. "*" = another flow covers every account.
 */
export function takenAccounts(kind: TriggerKindLike, mineId: string, others: FlowTriggerInfo[]): Map<string, string> {
  const taken = new Map<string, string>();
  if (kind !== "welcome" && kind !== "fallback") return taken;
  for (const o of others) {
    if (o.id === mineId || o.kind !== kind) continue;
    if (!o.channels.length) taken.set("*", o.name);
    for (const ch of o.channels) taken.set(ch, o.name);
  }
  return taken;
}
