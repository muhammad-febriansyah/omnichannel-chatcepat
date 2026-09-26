"use server";

import { revalidatePath } from "next/cache";
import { requireAbility } from "./rbac";
import { requireSession } from "./session";

const gateway = process.env.GATEWAY_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type SocialAccount = {
  id: string;
  name: string;
  platform: "facebook" | "instagram";
  username?: string | null;
  external_user_id?: string | null;
  status: string;
  last_activity_at?: string | null;
  last_connected_at?: string | null;
  last_error?: string | null;
};

export type AutoReplyAction = {
  id?: string;
  action_type: "reply_comment" | "send_private_reply" | "reply_message";
  content: string;
  sort_order: number;
  is_active: boolean;
  responses?: string[];
};

export type AutoReplyRule = {
  id: string;
  social_account_id: string;
  name: string;
  platform: "facebook" | "instagram";
  source_type: "comment" | "message";
  match_type: "exact" | "contains" | "starts_with";
  is_active: boolean;
  priority: number;
  keywords: string[];
  actions: AutoReplyAction[];
  created_at?: string;
};

export type IncomingSocialEvent = {
  id: string;
  account_id: string;
  platform: "facebook" | "instagram";
  source_type: "comment" | "message";
  external_id: string;
  author_name?: string | null;
  content: string;
  received_at: string;
  status: string;
  matched_rule_id?: string | null;
  is_from_self: boolean;
};

export type AutomationSettings = {
	comment_post_urls: string[];
  social_account_id: string;
  automation_enabled: boolean;
  comment_scanner_enabled: boolean;
  message_scanner_enabled: boolean;
  comment_reply_enabled: boolean;
  comment_private_reply_enabled: boolean;
  message_reply_enabled: boolean;
  reply_cooldown_seconds: number;
  max_consecutive_errors: number;
};

export type AutomationActivity = {
  id: string;
  event: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  social_account_id?: string;
  social_job_id?: string;
};

async function socialRequest<T>(session: Awaited<ReturnType<typeof requireSession>>, path: string, init?: RequestInit): Promise<T> {
  if (!session.tenantId) throw new Error("Tenant aktif tidak ditemukan");
  requireAbility(session, "flow.manage");
  const headers = new Headers(init?.headers);
  headers.set("X-Workspace-ID", session.tenantId);
  if (process.env.SOCIAL_API_TOKEN) headers.set("Authorization", `Bearer ${process.env.SOCIAL_API_TOKEN}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${gateway}${path}`, { ...init, headers, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string; data?: T };
  if (!response.ok || body.success === false) throw new Error(body.message ?? "Permintaan automation gagal");
  return body.data as T;
}

export async function getAutomationPageData() {
  const session = await requireSession();
  requireAbility(session, "flow.manage");
  const [accounts, rules, incoming, activity] = await Promise.all([
    socialRequest<SocialAccount[]>(session, "/api/accounts"),
    socialRequest<AutoReplyRule[]>(session, "/api/automation/rules"),
    socialRequest<IncomingSocialEvent[]>(session, "/api/automation/incoming"),
    socialRequest<AutomationActivity[]>(session, "/api/automation/activity"),
  ]);
  const settingsEntries = await Promise.all(
    accounts.map(async (account) => [account.id, await socialRequest<AutomationSettings>(session, `/api/accounts/${account.id}/automation/settings`)] as const),
  );
  return { accounts, rules, incoming, activity, settings: Object.fromEntries(settingsEntries) as Record<string, AutomationSettings> };
}

export async function createSocialAccount(input: {
  name: string;
  platform: "facebook" | "instagram";
  username?: string;
  external_user_id?: string;
}) {
  const session = await requireSession();
  const account = await socialRequest<SocialAccount>(session, "/api/accounts", { method: "POST", body: JSON.stringify(input) });
  revalidatePath("/automation");
  return account;
}

export async function connectSocialAccount(accountID: string) {
  const session = await requireSession();
  const account = await socialRequest<SocialAccount>(session, `/api/accounts/${accountID}/connect`, { method: "POST" });
  revalidatePath("/automation");
  return account;
}

export async function openSocialAccountBrowser(accountID: string) {
  const session = await requireSession();
  const account = await socialRequest<SocialAccount>(session, `/api/accounts/${accountID}/open-browser`, { method: "POST" });
  revalidatePath("/automation");
  return account;
}

export async function validateSocialAccountSession(accountID: string) {
  const session = await requireSession();
  const account = await socialRequest<SocialAccount>(session, `/api/accounts/${accountID}/validate-session`, { method: "POST" });
  revalidatePath("/automation");
  return account;
}

export async function createAutomationRule(input: {
  account_id: string;
  name: string;
  platform: string;
  source_type: string;
  match_type: string;
  is_active: boolean;
  priority: number;
  keywords: string[];
  actions: AutoReplyAction[];
}) {
  const session = await requireSession();
  await socialRequest(session, "/api/automation/rules", { method: "POST", body: JSON.stringify(input) });
  revalidatePath("/automation");
}

export async function toggleAutomationRule(ruleID: string, active: boolean) {
  const session = await requireSession();
  await socialRequest(session, `/api/automation/rules/${ruleID}/${active ? "enable" : "disable"}`, { method: "POST" });
  revalidatePath("/automation");
}

export async function deleteAutomationRule(ruleID: string) {
  const session = await requireSession();
  await socialRequest(session, `/api/automation/rules/${ruleID}`, { method: "DELETE" });
  revalidatePath("/automation");
}

export async function updateAutomationSettings(accountID: string, settings: Omit<AutomationSettings, "social_account_id">) {
  const session = await requireSession();
  await socialRequest(session, `/api/accounts/${accountID}/automation/settings`, { method: "PUT", body: JSON.stringify(settings) });
  revalidatePath("/automation");
}
