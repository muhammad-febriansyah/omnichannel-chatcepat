import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Workflow, Zap, ArrowRight, ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { flows } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { hasFeature } from "@/lib/entitlements";
import { createFlow } from "@/lib/actions";
import { PlanLock } from "@/components/app/plan-lock";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/app/status-pill";
import { Card, CardContent } from "@/components/ui/card";

async function load(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.flows.findMany({
      where: eq(flows.tenantId, tenantId),
      orderBy: [desc(flows.createdAt)],
    });
  } catch {
    return [];
  }
}

export default async function FlowsPage() {
  const session = await requirePageAbility("flow.manage");
  if (!hasFeature(session, "automation")) {
    return (
      <PlanLock
        title="Otomasi"
        feature="Otomasi (Flow Builder)"
        requiredPlan="Pro"
        description="Bangun chatbot alur otomatis untuk membalas pelanggan."
      />
    );
  }
  const rows = await load(session.tenantId);

  const active = rows.filter((f) => f.status === "active").length;

  return (
    <div className="p-6">
      <PageHeader
        icon={Workflow}
        title="Otomasi"
        description={rows.length ? `${rows.length} flow · ${active} aktif` : "Balas otomatis & alur kerja"}
        actions={
          <form action={createFlow}>
            <Button type="submit" size="lg">
              <Plus className="size-4" /> Flow Baru
            </Button>
          </form>
        }
      />

      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="Belum ada flow"
              description="Buat alur balas otomatis: pemicu (keyword, pesan masuk) → aksi. Hemat waktu tim CS."
              action={
                <form action={createFlow}>
                  <Button type="submit" size="lg">
                    <Plus className="size-4" /> Buat flow pertama
                  </Button>
                </form>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((f) => {
                const isActive = f.status === "active";
                const nodes = (f.definition as { nodes?: unknown[] })?.nodes ?? [];
                const stepCount = nodes.filter((n) => (n as { type?: string })?.type !== "trigger").length;
                return (
                  <Link
                    key={f.id}
                    href={`/flows/${f.id}`}
                    className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue dark:bg-blue-500/10">
                        <Workflow className="size-5" />
                      </div>
                      <StatusPill tone={isActive ? "emerald" : "slate"} className="gap-1.5">
                        <span className={`size-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {isActive ? "Aktif" : "Nonaktif"}
                      </StatusPill>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{f.name}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <Zap className="size-3 text-amber-500" /> {f.trigger}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <ListChecks className="size-3 text-brand-blue" /> {stepCount} langkah
                        </span>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-xs font-medium text-brand-blue">
                      Edit flow <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
