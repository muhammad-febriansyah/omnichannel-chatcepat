import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, gte, sql } from "drizzle-orm";
import { Boxes, Cpu, Gauge, Package } from "lucide-react";
import { db } from "@/lib/db";
import { aiCreditPacks, aiModels, aiProviders, aiUsage, tenants } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { decryptCreds } from "@/lib/channel-crypto";
import { PageHeader } from "@/components/app/page-header";
import { AiAdminPanel, type AiAdminData } from "@/components/app/ai-admin/ai-admin-panel";
import { cn } from "@/lib/utils";

type Tab = "model" | "fitur" | "topup" | "pemakaian";

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "model", label: "Provider & Model", icon: Cpu },
  { value: "fitur", label: "Fitur AI", icon: Boxes },
  { value: "topup", label: "Paket Top-up", icon: Package },
  { value: "pemakaian", label: "Pemakaian", icon: Gauge },
];

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function maskKey(enc: string): string {
  try {
    const plain = String(decryptCreds({ k: enc }).k ?? "");
    return plain ? `••••${plain.slice(-4)}` : "—";
  } catch {
    return "••••";
  }
}

export default async function AdminAiPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  if (!session.isPlatformAdmin) notFound();
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : "model";

  const since = daysAgo(30);
  const [providers, models, features, packs, byTenant, byFeature, tenantList] = await Promise.all([
    db.query.aiProviders.findMany({ orderBy: [asc(aiProviders.createdAt)] }),
    db.query.aiModels.findMany({ orderBy: [asc(aiModels.purpose), asc(aiModels.label)] }),
    db.query.aiFeatures.findMany(),
    db.query.aiCreditPacks.findMany({ orderBy: [asc(aiCreditPacks.sortOrder), asc(aiCreditPacks.priceIdr)] }),
    db
      .select({
        tenantId: aiUsage.tenantId,
        name: tenants.name,
        calls: sql<number>`count(*)::int`,
        charged: sql<number>`coalesce(sum(${aiUsage.chargedTokens}), 0)::bigint`,
        rawTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)::bigint`,
      })
      .from(aiUsage)
      .innerJoin(tenants, sql`${tenants.id} = ${aiUsage.tenantId}`)
      .where(gte(aiUsage.createdAt, since))
      .groupBy(aiUsage.tenantId, tenants.name)
      .orderBy(desc(sql`sum(${aiUsage.chargedTokens})`))
      .limit(50),
    db
      .select({
        feature: aiUsage.feature,
        model: aiUsage.model,
        calls: sql<number>`count(*)::int`,
        charged: sql<number>`coalesce(sum(${aiUsage.chargedTokens}), 0)::bigint`,
        rawTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens}), 0)::bigint`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, since))
      .groupBy(aiUsage.feature, aiUsage.model),
    db.query.tenants.findMany({ columns: { id: true, name: true }, orderBy: [asc(tenants.name)] }),
  ]);

  const data: AiAdminData = {
    providers: providers.map((p) => ({ id: p.id, name: p.name, kind: p.kind, baseUrl: p.baseUrl ?? "", isActive: p.isActive, keyHint: maskKey(p.apiKey) })),
    models: models.map((m) => ({
      id: m.id,
      providerId: m.providerId,
      model: m.model,
      label: m.label,
      purpose: m.purpose as "chat" | "embedding",
      inputMultiplier: Number(m.inputMultiplier),
      outputMultiplier: Number(m.outputMultiplier),
      isActive: m.isActive,
    })),
    features: features.map((f) => ({ feature: f.feature, modelId: f.modelId, isEnabled: f.isEnabled })),
    packs: packs.map((p) => ({ id: p.id, name: p.name, tokens: p.tokens, priceIdr: p.priceIdr, validDays: p.validDays, isActive: p.isActive, sortOrder: p.sortOrder })),
    usageByTenant: byTenant.map((r) => ({ ...r, charged: Number(r.charged), rawTokens: Number(r.rawTokens) })),
    usageByFeature: byFeature.map((r) => ({ ...r, charged: Number(r.charged), rawTokens: Number(r.rawTokens) })),
    tenants: tenantList,
  };

  return (
    <div className="p-6 sm:p-8">
      <PageHeader
        title="AI & Token"
        description="Hubungkan provider AI, pilih model tiap fitur, atur potongan token, dan jual paket top-up."
        tabs={
          <div className="inline-flex flex-wrap gap-1 rounded-[20px] bg-card p-1">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={t.value === "model" ? "/admin/ai" : `/admin/ai?tab=${t.value}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  t.value === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </Link>
            ))}
          </div>
        }
      />
      <AiAdminPanel tab={tab} data={data} />
    </div>
  );
}
