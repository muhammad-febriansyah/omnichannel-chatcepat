import Link from "next/link";
import { ArrowLeft, ArrowRight, PenLine } from "lucide-react";
import { requirePageAbility } from "@/lib/session";
import { loadDocs, loadPromos } from "@/lib/automation-data";
import { ASSISTANT_PRESETS, presetInput } from "@/lib/ai-agent-options";
import { PageHeader } from "@/components/app/page-header";
import { AgentForm } from "@/components/app/ai-agent/agent-form";

// Step 1: pick a ready-made assistant (or blank). Step 2 (?preset=…): edit and save.
export default async function NewAgentPage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  const session = await requirePageAbility("knowledge.manage");
  const { preset } = await searchParams;

  if (preset && session.tenantId) {
    const [docs, promos] = await Promise.all([loadDocs(session.tenantId), loadPromos(session.tenantId)]);
    return <AgentForm agentId={null} initial={presetInput(preset)} docs={docs} promos={promos} />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
      <Link href="/ai-agent" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Semua asisten
      </Link>
      <PageHeader title="Buat asisten AI" description="Pilih titik awal. Prompt, gaya, dan info bisnis tetap bisa diubah setelahnya." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ASSISTANT_PRESETS.map((p) => (
          <Link
            key={p.id}
            href={`/ai-agent/new?preset=${p.id}`}
            className="group flex flex-col gap-2 rounded-[20px] border border-transparent bg-card p-4 transition hover:border-brand-blue/40 hover:shadow-md"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-muted text-xl">{p.emoji}</span>
            <span className="text-[15px] font-semibold">{p.title}</span>
            <span className="text-[13px] leading-relaxed text-muted-foreground">{p.desc}</span>
            <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[13px] font-medium text-brand-blue">
              Pakai <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
        <Link
          href="/ai-agent/new?preset=kosong"
          className="group flex flex-col gap-2 rounded-[20px] border border-dashed border-border p-4 transition hover:border-brand-blue/40"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
            <PenLine className="size-5" />
          </span>
          <span className="text-[15px] font-semibold">Mulai dari kosong</span>
          <span className="text-[13px] leading-relaxed text-muted-foreground">Tulis prompt sendiri dari awal.</span>
        </Link>
      </div>
    </div>
  );
}
