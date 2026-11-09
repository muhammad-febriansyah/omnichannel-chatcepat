import Link from "next/link";
import { BookOpen, CircleHelp, FileSpreadsheet, FileText, MessageSquareText, Package, Plus, Sparkles } from "lucide-react";
import { ActionLink } from "@/components/app/action-link";
import { EditButton } from "@/components/app/action-button";
import { DeleteButton } from "@/components/app/delete-button";
import { StatusPill } from "@/components/app/status-pill";
import { timeAgo } from "@/lib/format";
import { deleteKnowledge } from "@/lib/actions";
import { deleteFaq } from "@/lib/knowledge-actions";
import type { FaqRow, UnansweredRow } from "@/lib/automation-data";
import { IgnoreQuestionButton } from "./ignore-question-button";

type Doc = { id: string; title: string; status: string };

function Section({
  icon: Icon,
  title,
  hint,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <p className="text-[13px] text-muted-foreground">{hint}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const ago = (iso: string) => {
  const t = timeAgo(iso);
  return t === "baru saja" ? t : `${t} lalu`;
};

// Automation → Pengetahuan: what the AI knows and what it could not answer yet.
export function KnowledgeTab({
  faqs,
  unanswered,
  docs,
  productCount,
}: {
  faqs: FaqRow[];
  unanswered: UnansweredRow[];
  docs: Doc[];
  productCount: number;
}) {
  const stats = [
    { label: "Tanya-jawab", value: faqs.filter((f) => f.isActive).length, icon: MessageSquareText },
    { label: "Belum terjawab", value: unanswered.length, icon: CircleHelp, warn: unanswered.length > 0 },
    { label: "Dokumen", value: docs.length, icon: FileText },
    { label: "Produk aktif", value: productCount, icon: Package },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-[20px] border border-border bg-card p-4 text-sm shadow-sm">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          <Sparkles className="size-[18px]" />
        </span>
        <p className="text-muted-foreground">
          AI menjawab dari <b className="text-foreground">Tanya-jawab</b> (prioritas utama), dokumen pengetahuan, katalog produk, dan info bisnis
          di langkah AI Agent. Pertanyaan yang tidak ada datanya muncul di <b className="text-foreground">Belum terjawab</b> — jawab sekali, AI
          langsung bisa.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-4 shadow-sm">
            <s.icon className={s.warn ? "size-5 text-amber-600" : "size-5 text-muted-foreground"} />
            <div>
              <div className="text-xl font-bold leading-none">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Section
        icon={CircleHelp}
        title="Belum terjawab"
        hint="Pertanyaan pelanggan yang tidak ada jawabannya di data. Paling sering ditanya di atas."
      >
        {unanswered.length === 0 ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Belum ada. Pertanyaan yang tidak bisa dijawab AI akan muncul di sini.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {unanswered.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{q.question}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ditanya {q.askCount}× · terakhir {ago(q.lastAskedAt)}
                    {q.conversationId && (
                      <>
                        {" · "}
                        <Link href={`/inbox/${q.conversationId}`} className="font-medium text-brand-blue hover:underline">
                          lihat chat
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <IgnoreQuestionButton id={q.id} />
                  <ActionLink href={`/knowledge/faq/new?from=${q.id}`} size="sm">
                    <Plus className="size-3.5" /> Jawab
                  </ActionLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={MessageSquareText}
        title="Tanya-jawab"
        hint="Jawaban resmi untuk pertanyaan yang sering muncul. AI memakainya lebih dulu daripada dokumen."
        action={
          <div className="flex gap-1.5">
            <ActionLink href="/knowledge/faq/import" size="sm" variant="outline">
              <FileSpreadsheet className="size-3.5" /> Import Excel
            </ActionLink>
            <ActionLink href="/knowledge/faq/new" size="sm">
              <Plus className="size-3.5" /> Tambah
            </ActionLink>
          </div>
        }
      >
        {faqs.length === 0 ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Belum ada tanya-jawab. Mulai dari yang paling sering ditanya: ongkir, cara bayar, jam buka, retur.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {faqs.map((f) => (
              <li key={f.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {f.question}
                    {!f.isActive && <StatusPill tone="slate">Nonaktif</StatusPill>}
                  </p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[13px] text-muted-foreground">{f.answer}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <EditButton href={`/knowledge/faq/${f.id}`} />
                  <DeleteButton
                    onConfirm={deleteFaq.bind(null, f.id)}
                    title="Hapus tanya-jawab?"
                    description={
                      <>
                        <span className="font-semibold text-foreground">{f.question}</span> dihapus. AI tidak lagi memakai jawaban ini.
                      </>
                    }
                    successMessage="Tanya-jawab dihapus"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          icon={BookOpen}
          title="Dokumen pengetahuan"
          hint="Ketik, upload PDF/Word, atau ambil dari halaman website Anda."
          action={
            <ActionLink href="/knowledge/docs/new" size="sm" variant="outline">
              <Plus className="size-3.5" /> Tambah
            </ActionLink>
          }
        >
          {docs.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">Belum ada dokumen.</p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
                  {d.status !== "ready" && <StatusPill tone="amber">Diproses</StatusPill>}
                  <DeleteButton
                    onConfirm={deleteKnowledge.bind(null, d.id)}
                    title="Hapus dokumen?"
                    description={
                      <>
                        Dokumen <span className="font-semibold text-foreground">{d.title}</span> dihapus dari pengetahuan AI.
                      </>
                    }
                    successMessage="Dokumen dihapus"
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={Package} title="Katalog produk" hint="AI mencari produk yang cocok dengan pertanyaan pelanggan dari seluruh katalog.">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
            <p className="text-sm">
              <b>{productCount}</b> produk aktif
              {productCount === 0 && <span className="text-muted-foreground"> — AI belum bisa menyebut produk & harga.</span>}
            </p>
            <ActionLink href="/products" size="sm" variant="outline">
              <Package className="size-3.5" /> Kelola produk
            </ActionLink>
          </div>
        </Section>
      </div>
    </div>
  );
}
