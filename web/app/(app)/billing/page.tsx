import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { Check, Crown, Receipt, Sparkles, Workflow, X, Zap } from "lucide-react";
import { requirePageAbility } from "@/lib/session";
import { can } from "@/lib/rbac";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { listActivePlans, listOrders, startCheckout, startTopup } from "@/lib/billing-actions";
import { sessionEntitlements } from "@/lib/entitlements";
import { listTopupPacks, loadAiBalance } from "@/lib/ai-balance";
import { CHANNEL_KINDS, PLAN_FEATURES, fmtLimit, fmtTokens, resolveEntitlements, type PlanEntitlements } from "@/lib/plan-config";
import { featureLabel } from "@/lib/ai-admin-options";
import { PALETTE_GROUPS } from "@/components/app/flow-builder/meta";
import { PLAN_LABEL, type TenantPlan } from "@/lib/plan";
import { rupiah } from "@/lib/format";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/app/status-pill";
import { SubmitButton } from "@/components/app/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ClientOrdersTable } from "@/components/app/client-orders-table";
import { cn } from "@/lib/utils";

const TOTAL_NODES = PALETTE_GROUPS.reduce((n, g) => n + g.kinds.length, 0);
const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso)) : "Tanpa batas";
const SOURCE_LABEL: Record<string, string> = { plan: "Kuota paket bulan ini", topup: "Top-up", bonus: "Bonus" };

// What a plan includes, generated from its entitlements (not hand-written bullets).
function EntitlementList({ e }: { e: PlanEntitlements }) {
  const perType = CHANNEL_KINDS.filter((c) => e.limits.channels[c.value] !== null);
  const nodes = e.flowNodes === null ? TOTAL_NODES : e.flowNodes.length;
  const rows: { ok: boolean; text: string }[] = [
    { ok: e.aiTokensMonthly > 0, text: e.aiTokensMonthly > 0 ? `${fmtTokens(e.aiTokensMonthly)} token AI / bulan` : "Tanpa token AI" },
    { ok: true, text: `${fmtLimit(e.limits.maxChannels)} channel${perType.length ? ` (${perType.map((c) => `${e.limits.channels[c.value]} ${c.label}`).join(", ")})` : ""}` },
    { ok: true, text: `${fmtLimit(e.limits.maxAgents)} anggota tim` },
    { ok: true, text: `${fmtLimit(e.limits.maxKbDocs)} dokumen pengetahuan` },
    { ok: e.features.broadcast, text: e.features.broadcast ? `Broadcast ${fmtLimit(e.limits.broadcastPerMonth)} penerima / bulan` : "Broadcast" },
    { ok: e.features.automation, text: e.features.automation ? `Automation · ${nodes}/${TOTAL_NODES} langkah flow` : "Automation" },
    ...PLAN_FEATURES.filter((f) => !f.hidden && f.value !== "automation" && f.value !== "broadcast").map((f) => ({ ok: e.features[f.value], text: f.label })),
  ];
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.text} className={cn("flex items-start gap-2", !r.ok && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          {r.ok ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />}
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function BillingPage() {
  const session = await requirePageAbility("billing.tenant");
  // admin platform tidak berlangganan — kelola paket di konsol platform.
  if (session.isPlatformAdmin) redirect("/admin/plans");
  const tenantId = session.tenantId!;
  const current = await sessionEntitlements(session);
  const [plans, orders, balance, packs, channelCounts] = await Promise.all([
    listActivePlans(),
    listOrders(),
    loadAiBalance(tenantId, current.aiTokensMonthly),
    listTopupPacks(),
    db.select({ type: channels.type, n: sql<number>`count(*)::int` }).from(channels).where(eq(channels.tenantId, tenantId)).groupBy(channels.type),
  ]);
  const canBuy = can(session, "billing.tenant");
  const totalChannels = channelCounts.reduce((s, c) => s + c.n, 0);
  const pct = current.aiTokensMonthly > 0 ? Math.min(100, Math.round((balance.usedThisMonth / current.aiTokensMonthly) * 100)) : 0;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Tagihan & Paket" description="Paket aktif, saldo token AI, top-up, dan riwayat pembayaran." />

      {/* Current plan + AI tokens */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardDescription>Paket aktif</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {current.planName}
              <Badge variant="secondary">{session.planTrial && !session.planExpired ? "Trial" : PLAN_LABEL[(session.plan as TenantPlan) ?? "basic"]}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {session.planExpired
                ? session.planTrial
                  ? "Masa trial berakhir — fitur kembali ke Basic. Pilih paket di bawah untuk lanjut."
                  : "Langganan berakhir — fitur kembali ke Basic."
                : session.planTrial && session.planExpiresAt
                  ? `Trial gratis sampai ${fmtDate(session.planExpiresAt)}`
                  : session.planExpiresAt
                  ? `Berlaku sampai ${fmtDate(session.planExpiresAt)}`
                  : "Berlaku tanpa batas waktu"}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground">Channel terhubung</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {totalChannels} <span className="text-sm font-medium text-muted-foreground">/ {fmtLimit(current.limits.maxChannels)}</span>
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {CHANNEL_KINDS.map((c) => {
                  const used = channelCounts.find((x) => x.type === c.value)?.n ?? 0;
                  const max = current.limits.channels[c.value];
                  if (!used && max === null) return null;
                  return (
                    <li key={c.value} className="flex justify-between">
                      <span>{c.label}</span>
                      <span className="tabular-nums">
                        {used}
                        {max !== null && ` / ${max}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Workflow className="size-3.5" /> Langkah flow
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {current.flowNodes === null ? TOTAL_NODES : current.flowNodes.length} <span className="text-sm font-medium text-muted-foreground">/ {TOTAL_NODES}</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">Langkah di luar paket tampil terkunci di Automation.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> Saldo token AI
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{balance.remaining.toLocaleString("id-ID")}</CardTitle>
            <p className="text-sm text-muted-foreground">Dipakai saat AI membalas, uji AI, dan mengindeks dokumen. Habis → percakapan dialihkan ke CS.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Terpakai bulan ini</span>
                <span className="tabular-nums">
                  {balance.usedThisMonth.toLocaleString("id-ID")} / {current.aiTokensMonthly.toLocaleString("id-ID")} kuota paket
                </span>
              </div>
              <Progress value={pct} />
            </div>
            {balance.buckets.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                {balance.buckets.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {SOURCE_LABEL[b.source] ?? b.source}
                      <span className="block text-xs text-muted-foreground">Hangus {fmtDate(b.expiresAt)}</span>
                    </span>
                    <span className="tabular-nums">{Math.max(0, b.total - b.used).toLocaleString("id-ID")}</span>
                  </li>
                ))}
              </ul>
            )}
            {balance.usage30d.length > 0 && (
              <p className="text-xs text-muted-foreground">
                30 hari: {balance.usage30d.map((u) => `${featureLabel(u.feature)} ${u.charged.toLocaleString("id-ID")}`).join(" · ")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top-up packs */}
      {packs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Top-up token AI</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {packs.map((p) => (
              <Card key={p.id} size="sm">
                <CardHeader>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription>
                    {fmtTokens(p.tokens)} token · berlaku {p.validDays} hari
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-2xl font-bold tabular-nums">{rupiah(p.priceIdr)}</p>
                  <form action={startTopup.bind(null, p.id)}>
                    <SubmitButton className="w-full" pendingText="Membuka pembayaran…">
                      <Zap className="size-4" /> Beli top-up
                    </SubmitButton>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Plans */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Crown className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Pilih paket</h2>
        </div>
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">Belum ada paket tersedia. Hubungi admin.</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => {
              const e = resolveEntitlements(p.tier as TenantPlan, p);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative flex flex-col rounded-[20px] bg-card p-6 transition",
                    p.highlight ? "border-primary ring-2 ring-primary/15" : "border-border",
                  )}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                      <Sparkles className="size-3" /> Populer
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <StatusPill tone="slate">{PLAN_LABEL[p.tier as TenantPlan] ?? p.tier}</StatusPill>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-3xl font-bold tracking-tight">{p.priceIdr === 0 ? "Hubungi kami" : rupiah(p.priceIdr)}</span>
                    {p.priceIdr > 0 && <span className="mb-1 text-sm text-muted-foreground">/{p.period === "year" ? "tahun" : "bulan"}</span>}
                  </div>
                  <div className="mt-5 flex-1 space-y-4">
                    <EntitlementList e={e} />
                    {(p.features ?? []).length > 0 && (
                      <ul className="space-y-2 border-t border-border pt-4 text-sm">
                        {(p.features ?? []).map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <form action={startCheckout.bind(null, p.id)} className="mt-6">
                    <SubmitButton className="w-full" pendingText="Membuka pembayaran…">
                      <Crown className="size-4" /> {current.planName === p.name ? "Perpanjang" : "Pilih paket"}
                    </SubmitButton>
                  </form>
                  {!canBuy && <p className="mt-2 text-center text-xs text-muted-foreground">Hanya admin yang bisa membeli paket.</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Riwayat Transaksi</h2>
        </div>
        <Card>
          <CardContent>
            <ClientOrdersTable rows={orders} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
