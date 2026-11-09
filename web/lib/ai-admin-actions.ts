"use server";

import { errorMessage, userError } from "@/lib/action-error";
// Superadmin: AI providers + models, which model powers each feature, token
// multipliers ("potongan" token), top-up packs, and manual token grants.
// The engine reads these tables (cached 30s) — see engine/app/ai/registry.py.

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { aiCreditBuckets, aiCreditPacks, aiFeatures, aiModels, aiProviders, tenants } from "./db/schema";
import { requireSession } from "./session";
import { requireAbility } from "./rbac";
import { decryptCreds, encryptCreds } from "./channel-crypto";
import { writeAudit } from "./audit";
import { AI_FEATURES, type AiFeatureKey } from "./ai-admin-options";

async function admin() {
  const session = await requireSession();
  requireAbility(session, "tenant.manage");
  if (!session.isPlatformAdmin) throw userError("Hanya superadmin");
  return session;
}

const first = (e: z.ZodError) => e.issues[0]?.message ?? "Data tidak valid";
const done = () => revalidatePath("/admin/ai");

// --- Providers ---------------------------------------------------------------------

const providerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(60),
  kind: z.enum(["anthropic", "openai", "openai_compatible"]),
  apiKey: z.string().trim().max(500),
  baseUrl: z.string().trim().max(300),
  isActive: z.boolean(),
});
export type ProviderInput = z.infer<typeof providerSchema>;

export async function saveProvider(id: string | null, input: ProviderInput): Promise<void> {
  const session = await admin();
  const p = providerSchema.safeParse(input);
  if (!p.success) throw userError(first(p.error));
  const v = p.data;
  if (v.kind === "openai_compatible" && !/^https?:\/\//.test(v.baseUrl)) throw userError("Base URL wajib diisi (https://…)");
  if (!id && !v.apiKey) throw userError("API key wajib diisi");
  const values = {
    name: v.name,
    kind: v.kind,
    baseUrl: v.kind === "openai_compatible" ? v.baseUrl : null,
    isActive: v.isActive,
    // Blank key on edit = keep the stored one.
    ...(v.apiKey ? { apiKey: String(encryptCreds({ k: v.apiKey }).k) } : {}),
  };
  if (id) {
    await db.update(aiProviders).set({ ...values, updatedAt: sql`now()` }).where(eq(aiProviders.id, id));
  } else {
    await db.insert(aiProviders).values({ ...values, apiKey: values.apiKey! });
  }
  await writeAudit(session, { action: id ? "ai.provider.update" : "ai.provider.create", targetType: "ai_provider", targetLabel: v.name });
  done();
}

export async function deleteProvider(id: string): Promise<void> {
  const session = await admin();
  await db.delete(aiProviders).where(eq(aiProviders.id, id));
  await writeAudit(session, { action: "ai.provider.delete", targetType: "ai_provider", targetId: id });
  done();
}

// Check the key works and list the provider's models (to pick from).
export async function testProvider(id: string): Promise<{ ok: boolean; message: string; models: string[] }> {
  await admin();
  const p = await db.query.aiProviders.findFirst({ where: eq(aiProviders.id, id) });
  if (!p) throw userError("Provider tidak ditemukan");
  const key = String(decryptCreds({ k: p.apiKey }).k ?? "");
  try {
    const res =
      p.kind === "anthropic"
        ? await fetch("https://api.anthropic.com/v1/models?limit=100", {
            headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
            cache: "no-store",
          })
        : await fetch(`${(p.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/models`, {
            headers: { Authorization: `Bearer ${key}` },
            cache: "no-store",
          });
    const body = (await res.json().catch(() => ({}))) as { data?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, message: body.error?.message ?? `HTTP ${res.status}`, models: [] };
    const models = (body.data ?? []).map((m) => m.id).sort();
    return { ok: true, message: `Terhubung · ${models.length} model tersedia`, models };
  } catch (e) {
    return { ok: false, message: errorMessage(e) ?? "Gagal menghubungi provider", models: [] };
  }
}

// --- Models --------------------------------------------------------------------------

const modelSchema = z.object({
  providerId: z.string().uuid("Pilih provider"),
  model: z.string().trim().min(1, "ID model wajib diisi").max(120),
  label: z.string().trim().min(1, "Nama tampilan wajib diisi").max(80),
  purpose: z.enum(["chat", "embedding"]),
  inputMultiplier: z.number().min(0, "Pengali tidak boleh negatif").max(1000),
  outputMultiplier: z.number().min(0, "Pengali tidak boleh negatif").max(1000),
  isActive: z.boolean(),
});
export type ModelInput = z.infer<typeof modelSchema>;

export async function saveModel(id: string | null, input: ModelInput): Promise<void> {
  const session = await admin();
  const p = modelSchema.safeParse(input);
  if (!p.success) throw userError(first(p.error));
  const v = p.data;
  const values = {
    providerId: v.providerId,
    model: v.model,
    label: v.label,
    purpose: v.purpose,
    inputMultiplier: String(v.inputMultiplier),
    outputMultiplier: String(v.outputMultiplier),
    isActive: v.isActive,
  };
  try {
    if (id) await db.update(aiModels).set({ ...values, updatedAt: sql`now()` }).where(eq(aiModels.id, id));
    else await db.insert(aiModels).values(values);
  } catch {
    throw userError("Model ini sudah terdaftar di provider tersebut");
  }
  await writeAudit(session, { action: id ? "ai.model.update" : "ai.model.create", targetType: "ai_model", targetLabel: v.label });
  done();
}

export async function deleteModel(id: string): Promise<void> {
  const session = await admin();
  await db.delete(aiModels).where(eq(aiModels.id, id));
  await writeAudit(session, { action: "ai.model.delete", targetType: "ai_model", targetId: id });
  done();
}

// --- Features → model ----------------------------------------------------------------

export async function setFeature(feature: AiFeatureKey, modelId: string | null, isEnabled: boolean): Promise<void> {
  const session = await admin();
  if (!AI_FEATURES.some((f) => f.value === feature)) throw userError("Fitur tidak dikenal");
  if (modelId) {
    const m = await db.query.aiModels.findFirst({ where: eq(aiModels.id, modelId), columns: { purpose: true } });
    if (!m) throw userError("Model tidak ditemukan");
    const want = AI_FEATURES.find((f) => f.value === feature)!.purpose;
    if (m.purpose !== want) throw userError(want === "embedding" ? "Pilih model embedding" : "Pilih model chat");
  }
  await db
    .insert(aiFeatures)
    .values({ feature, modelId, isEnabled })
    .onConflictDoUpdate({ target: aiFeatures.feature, set: { modelId, isEnabled, updatedAt: sql`now()` } });
  await writeAudit(session, { action: "ai.feature.update", targetType: "ai_feature", targetLabel: feature });
  done();
}

// --- Top-up packs ----------------------------------------------------------------------

const packSchema = z.object({
  name: z.string().trim().min(1, "Nama paket wajib diisi").max(60),
  tokens: z.number().int().min(1000, "Minimal 1.000 token"),
  priceIdr: z.number().int().min(0, "Harga tidak boleh negatif"),
  validDays: z.number().int().min(1, "Masa berlaku minimal 1 hari").max(3650),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});
export type PackInput = z.infer<typeof packSchema>;

export async function savePack(id: string | null, input: PackInput): Promise<void> {
  const session = await admin();
  const p = packSchema.safeParse(input);
  if (!p.success) throw userError(first(p.error));
  if (id) await db.update(aiCreditPacks).set({ ...p.data, updatedAt: sql`now()` }).where(eq(aiCreditPacks.id, id));
  else await db.insert(aiCreditPacks).values(p.data);
  await writeAudit(session, { action: id ? "ai.pack.update" : "ai.pack.create", targetType: "ai_pack", targetLabel: p.data.name });
  done();
  revalidatePath("/billing");
}

export async function deletePack(id: string): Promise<void> {
  const session = await admin();
  await db.delete(aiCreditPacks).where(eq(aiCreditPacks.id, id));
  await writeAudit(session, { action: "ai.pack.delete", targetType: "ai_pack", targetId: id });
  done();
  revalidatePath("/billing");
}

// --- Manual grant (support / promo) ----------------------------------------------------

export async function grantTokens(tenantId: string, tokens: number, validDays: number, note: string): Promise<void> {
  const session = await admin();
  if (!Number.isInteger(tokens) || tokens <= 0) throw userError("Jumlah token tidak valid");
  if (!Number.isInteger(validDays) || validDays <= 0) throw userError("Masa berlaku tidak valid");
  const t = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId), columns: { name: true } });
  if (!t) throw userError("Tenant tidak ditemukan");
  await db.insert(aiCreditBuckets).values({
    tenantId,
    source: "bonus",
    tokensTotal: tokens,
    expiresAt: new Date(Date.now() + validDays * 86_400_000).toISOString(),
    note: note.trim().slice(0, 200) || "Bonus dari admin",
  });
  await writeAudit(session, { action: "ai.tokens.grant", targetType: "tenant", targetId: tenantId, targetLabel: `${t.name}: +${tokens}` });
  done();
}
