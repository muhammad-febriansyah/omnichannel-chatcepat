import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Workflow, Zap, ArrowRight, ListChecks, Clock, LayoutTemplate, GraduationCap, Megaphone, ShieldCheck, Settings2, BookOpen } from "lucide-react";
import { loadBroadcastHistory, loadKnowledgeOverview } from "@/lib/automation-data";
import { KnowledgeTab } from "@/components/app/knowledge/knowledge-tab";
import { ReplySettings } from "@/components/app/reply-settings";
import type { FallbackAction } from "@/lib/actions";
import { BroadcastsTable } from "@/components/app/broadcasts-table";
import { can } from "@/lib/rbac";
import { FlowTemplatesGallery } from "@/components/app/flow-templates-gallery";
import { FlowGuide } from "@/components/app/flow-guide";
import { TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/flow-templates";
import { cn } from "@/lib/utils";
import { ActionLink } from "@/components/app/action-link";
import { timeAgo } from "@/lib/format";
import { db } from "@/lib/db";
import { channels, flows } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { allowedFlowNodes, hasFeature } from "@/lib/entitlements";
import { createFlow, deleteFlow } from "@/lib/actions";
import { DeleteButton } from "@/components/app/delete-button";
import { FlowActiveToggle } from "@/components/app/flow-active-toggle";
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
      orderBy: [desc(flows.updatedAt)],
    });
  } catch {
    return [];
  }
}

// Automation → Pengaturan Balasan: per-account auto-reply + what happens when no flow matches.
async function replySettings(tenantId: string) {
  const accounts = await db.query.channels.findMany({
    where: eq(channels.tenantId, tenantId),
    orderBy: [desc(channels.createdAt)],
    columns: { id: true, name: true, type: true, status: true, autoReplyEnabled: true, fallbackAction: true, fallbackMessage: true },
  });
  const first = accounts[0];
  return (
    <ReplySettings
      accounts={accounts.map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status, autoReply: c.autoReplyEnabled }))}
      fallbackAction={(first?.fallbackAction ?? "message") as FallbackAction}
      fallbackMessage={first?.fallbackMessage ?? ""}
    />
  );
}

type Tab = "flow" | "broadcast" | "template" | "pengetahuan" | "pengaturan" | "panduan";

const TABS: { value: Tab; label: string; icon: React.ElementType }[] = [
  { value: "flow", label: "Flow", icon: Workflow },
  { value: "broadcast", label: "Riwayat Broadcast", icon: Megaphone },
  { value: "template", label: "Template", icon: LayoutTemplate },
  { value: "pengetahuan", label: "Pengetahuan", icon: BookOpen },
  { value: "pengaturan", label: "Pengaturan Balasan", icon: Settings2 },
  { value: "panduan", label: "Panduan", icon: GraduationCap },
];

export default async function FlowsPage({ searchParams }: { searchParams: Promise<{ tab?: string; kat?: string }> }) {
  const session = await requirePageAbility("flow.manage");
  const { tab: rawTab, kat } = await searchParams;
  const canBroadcast = can(session, "broadcast.manage");
  const tabs = TABS.filter((t) => t.value !== "broadcast" || canBroadcast);
  const tab: Tab = tabs.some((t) => t.value === rawTab) ? (rawTab as Tab) : "flow";
  const category = TEMPLATE_CATEGORIES.find((c) => c.value === kat)?.value as TemplateCategory | undefined;
  if (!(await hasFeature(session, "automation")) && !(await hasFeature(session, "broadcast"))) {
    return (
      <PlanLock
        title="Otomasi"
        feature="Otomasi (Flow Builder)"
        requiredPlan="Pro"
        description="Bangun chatbot alur otomatis untuk membalas pelanggan."
      />
    );
  }
  const [rows, history] = await Promise.all([
    load(session.tenantId),
    tab === "broadcast" && session.tenantId ? loadBroadcastHistory(session.tenantId).catch(() => []) : Promise.resolve([]),
  ]);

  const active = rows.filter((f) => f.status === "active").length;

  return (
    <div className="p-6">
      <PageHeader
        title="Automation"
        description={
          rows.length
            ? `${rows.length} flow · ${active} aktif — pemicu, pesan, menu, dan AI Agent dalam satu kanvas`
            : "Bangun alur balas otomatis: pemicu → pesan → menu → AI Agent (pengetahuan & promo diatur di node AI)"
        }
        actions={
          tab === "broadcast" ? (
            <ActionLink href="/flows?tab=template&kat=broadcast">
              <Megaphone className="size-4" /> Broadcast Baru
            </ActionLink>
          ) : tab === "flow" ? (
            <div className="flex flex-wrap gap-2">
              <ActionLink href="/flows?tab=template" variant="outline">
                <LayoutTemplate className="size-4" /> Dari Template
              </ActionLink>
              <form action={createFlow}>
                <Button type="submit" size="lg">
                  <Plus className="size-4" /> Flow Baru
                </Button>
              </form>
            </div>
          ) : null
        }
        tabs={
          <div className="inline-flex flex-wrap gap-1 rounded-[20px] border border-border bg-card p-1 shadow-sm">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = t.value === tab;
              return (
                <Link
                  key={t.value}
                  href={t.value === "flow" ? "/flows" : `/flows?tab=${t.value}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-brand-blue text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {t.label}
                </Link>
              );
            })}
          </div>
        }
      />

      {tab === "template" && <FlowTemplatesGallery key={category ?? "all"} category={category} allowedNodes={await allowedFlowNodes(session)} />}
      {tab === "panduan" && <FlowGuide />}
      {tab === "pengaturan" && session.tenantId && (await replySettings(session.tenantId))}
      {tab === "pengetahuan" && session.tenantId && <KnowledgeTab {...await loadKnowledgeOverview(session.tenantId)} />}
      {tab === "broadcast" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-[20px] bg-card p-4 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <ShieldCheck className="size-[18px]" />
            </span>
            <p className="text-muted-foreground">
              Broadcast dibuat sebagai flow dengan pemicu <b className="text-foreground">Broadcast terjadwal</b>: pilih akun WhatsApp, penerima, dan
              jadwal, lalu atur langkah saat kontak membalas atau klik tombol. Hanya kontak <b className="text-foreground">opt-in</b> yang dikirimi.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <BroadcastsTable rows={history} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "flow" && (
      <Card>
        <CardContent className="pt-6">
          {rows.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="Belum ada flow"
              description="Buat alur balas otomatis: pemicu (keyword, pesan masuk) → aksi. Hemat waktu tim CS."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ActionLink href="/flows?tab=template" variant="outline">
                    <LayoutTemplate className="size-4" /> Pilih template
                  </ActionLink>
                  <form action={createFlow}>
                    <Button type="submit" size="lg">
                      <Plus className="size-4" /> Flow kosong
                    </Button>
                  </form>
                </div>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((f) => {
                const isActive = f.status === "active";
                const def = f.definition as {
                  nodes?: { type?: string; trigger?: { match?: string[] } }[];
                  ui?: { nodes?: { type?: string }[] };
                };
                // Canvas nodes = what the user built; runtime nodes include menu internals.
                const stepCount = (def?.ui?.nodes ?? def?.nodes ?? []).filter((n) => n?.type !== "trigger").length;
                const keywords = def?.nodes?.find((n) => n?.type === "trigger")?.trigger?.match ?? [];
                const triggerLabel =
                  f.trigger === "welcome"
                    ? "Awal percakapan"
                    : f.trigger === "fallback"
                      ? "Cadangan"
                      : f.trigger === "button"
                        ? "Klik tombol"
                        : f.trigger === "comment"
                          ? "Komentar FB/IG"
                          : f.trigger === "broadcast"
                            ? "Broadcast terjadwal"
                            : "Keyword";
                return (
                  <div
                    key={f.id}
                    className="group relative flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md"
                  >
                    <Link href={`/flows/${f.id}`} className="flex flex-col gap-3">
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
                          <Zap className="size-3 text-amber-500" /> {triggerLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <ListChecks className="size-3 text-brand-blue" /> {stepCount} langkah
                        </span>
                      </div>
                      {(f.trigger === "keyword" || f.trigger === "button" || f.trigger === "comment") && keywords.length > 0 && (
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          {f.trigger === "button" ? "Tombol" : f.trigger === "comment" ? "Kata kunci" : "Keyword"}: {keywords.slice(0, 4).join(", ")}
                          {keywords.length > 4 ? ` +${keywords.length - 4}` : ""}
                        </p>
                      )}
                    </div>
                    </Link>
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3" /> Diperbarui {timeAgo(f.updatedAt)}{timeAgo(f.updatedAt) === "baru saja" ? "" : " lalu"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {/* Broadcasts are scheduled from the editor; here they can only be stopped. */}
                        {(f.trigger !== "broadcast" || isActive) && <FlowActiveToggle id={f.id} name={f.name} active={isActive} />}
                        <DeleteButton
                          onConfirm={deleteFlow.bind(null, f.id)}
                          title="Hapus flow?"
                          description={
                            <>
                              Flow <span className="font-semibold text-foreground">{f.name}</span> dihapus permanen dan berhenti membalas pesan.
                              {f.trigger === "broadcast" ? " Broadcast yang belum terkirim ikut dibatalkan." : ""}
                            </>
                          }
                          successMessage="Flow dihapus"
                        />
                        <Link href={`/flows/${f.id}`} className="inline-flex items-center gap-1 font-medium text-brand-blue">
                          Buka editor <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                        </Link>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
