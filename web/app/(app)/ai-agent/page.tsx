import { Bot, Plus, Star } from "lucide-react";
import { requirePageAbility } from "@/lib/session";
import { loadAgents } from "@/lib/automation-data";
import { deleteAgent } from "@/lib/ai-agent-actions";
import { roleLabel, toneMeta } from "@/lib/ai-agent-options";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ActionLink } from "@/components/app/action-link";
import { EditButton } from "@/components/app/action-button";
import { DeleteButton } from "@/components/app/delete-button";
import { StatusPill } from "@/components/app/status-pill";
import { MakeDefaultButton } from "@/components/app/ai-agent/make-default-button";

export default async function AgentsPage() {
  const session = await requirePageAbility("knowledge.manage");
  const agents = session.tenantId ? await loadAgents(session.tenantId) : [];

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Asisten AI"
        description="Atur siapa yang membalas: nama, prompt, gaya bahasa, dan info bisnis. Asisten default menjawab otomatis; node AI di flow juga bisa memilih asisten lain."
        actions={
          <ActionLink href="/ai-agent/new">
            <Plus className="size-4" /> Asisten Baru
          </ActionLink>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Belum ada asisten"
          description="Mulai dari template Customer Service, Sales, Reservasi, dan lainnya — lalu sesuaikan dengan bisnis Anda."
          action={
            <ActionLink href="/ai-agent/new">
              <Plus className="size-4" /> Buat asisten pertama
            </ActionLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => {
            const tone = toneMeta(a.tone);
            return (
              <div key={a.id} className="flex flex-col rounded-[20px] border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-xl dark:bg-violet-500/15">{tone.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{a.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {[a.assistantName && `"${a.assistantName}"`, a.businessName].filter(Boolean).join(" · ") || "Nama asisten belum diisi"}
                    </div>
                  </div>
                  {a.isDefault && (
                    <StatusPill tone="blue" className="shrink-0 gap-1">
                      <Star className="size-3" /> Default
                    </StatusPill>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <StatusPill tone="slate">{roleLabel(a.role)}</StatusPill>
                  <StatusPill tone="slate">{tone.label}</StatusPill>
                  {!a.isActive && <StatusPill tone="amber">Nonaktif</StatusPill>}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-4">
                  {!a.isDefault && <MakeDefaultButton id={a.id} />}
                  <EditButton href={`/ai-agent/${a.id}`} />
                  <DeleteButton
                    onConfirm={deleteAgent.bind(null, a.id)}
                    title="Hapus asisten?"
                    description={
                      <>
                        Asisten <span className="font-semibold text-foreground">{a.name}</span> dihapus permanen. Channel dan node AI
                        yang memakainya akan beralih ke asisten default.
                      </>
                    }
                    successMessage="Asisten dihapus"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        Asisten <b>default</b> menjawab pesan yang tidak cocok flow (bila Pengaturan Balasan = Dijawab AI) dan di node AI yang memakai &quot;Asisten default&quot;.
      </p>
    </div>
  );
}
