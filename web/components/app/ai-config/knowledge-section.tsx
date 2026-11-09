"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/action-error";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KbMarkdownEditor } from "@/components/app/kb-markdown-editor";
import { addKnowledge, deleteKnowledge } from "@/lib/actions";
import { deletePromo, savePromo, type PromoInput } from "@/lib/ai-agent-actions";
import type { KnowledgeDoc, PromoItem, PromoState } from "@/lib/ai-agent-options";
import { cn } from "@/lib/utils";

const inputCls =
  "h-9 w-full text-sm";

const STATE_STYLE: Record<PromoState, { label: string; cls: string }> = {
  berjalan: { label: "Berjalan", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  terjadwal: { label: "Terjadwal", cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" },
  berakhir: { label: "Berakhir", cls: "bg-muted text-muted-foreground" },
  nonaktif: { label: "Nonaktif", cls: "bg-muted text-muted-foreground" },
};

// Small confirm for deleting a doc/promo from inside the node panel.
function ConfirmDelete({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await onConfirm();
                onOpenChange(false);
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Hapus
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Documents -----------------------------------------------------------------------

export function KnowledgeDocs({
  docs,
  all,
  selected,
  onAllChange,
  onSelectedChange,
}: {
  docs: KnowledgeDoc[];
  all: boolean;
  selected: string[];
  onAllChange: (v: boolean) => void;
  onSelectedChange: (ids: string[]) => void;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [toDelete, setToDelete] = useState<KnowledgeDoc | null>(null);
  const [pending, start] = useTransition();

  function add() {
    if (!title.trim() || !text.trim()) return gooeyToast.error("Judul & isi wajib diisi");
    start(async () => {
      try {
        await gooeyToast.promise(addKnowledge(title.trim(), text), {
          loading: "Memproses dokumen…",
          success: "Dokumen ditambahkan",
          error: (e: unknown) => (errorMessage(e) ?? "Gagal menambah dokumen"),
        });
        setTitle("");
        setText("");
        setAdding(false);
        router.refresh();
      } catch {
        /* toast shown */
      }
    });
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[13px] font-medium">Pakai semua dokumen</span>
          <span className="block text-[11px] text-muted-foreground">Matikan untuk memilih dokumen tertentu</span>
        </span>
        <Switch checked={all} onCheckedChange={onAllChange} />
      </label>

      <div className="rounded-lg border border-border">
        {docs.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Belum ada dokumen. Tambahkan FAQ, jam buka, cara order, atau kebijakan toko.</p>
        ) : (
          <ul className="max-h-48 divide-y divide-border overflow-y-auto">
            {docs.map((d) => {
              const checked = all || selected.includes(d.id);
              return (
                <li key={d.id} className="group flex items-center gap-2 px-2.5 py-1.5">
                  <Checkbox
                    aria-label={`Pakai ${d.title}`}
                    checked={checked}
                    disabled={all}
                    onCheckedChange={() => onSelectedChange(checked ? selected.filter((x) => x !== d.id) : [...selected, d.id])}
                  />
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{d.title}</span>
                  {d.status !== "ready" && (
                    <span className="rounded bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">diproses</span>
                  )}
                  <button
                    type="button"
                    aria-label={`Hapus ${d.title}`}
                    onClick={() => setToDelete(d)}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-muted hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-border p-1.5">
          <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Tambah dokumen
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">Dokumen dipakai bersama semua node AI — tidak perlu upload ulang.</p>

      <Dialog open={adding} onOpenChange={(o) => !pending && setAdding(o)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Tambah pengetahuan</DialogTitle>
            <DialogDescription>FAQ, kebijakan, jam buka, cara order — mendukung Markdown. AI menjawab dari isi ini.</DialogDescription>
          </DialogHeader>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul, mis. FAQ Pengiriman" className={inputCls} />
          <KbMarkdownEditor value={text} onChange={setText} rows={10} placeholder={"Tanya: Berapa lama pengiriman?\nJawab: 2–3 hari kerja untuk Jawa…"} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={add} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Simpan dokumen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Hapus dokumen?"
        description={
          <>
            <b>{toDelete?.title}</b> dihapus permanen dan tidak dipakai lagi oleh semua node AI.
          </>
        }
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteKnowledge(toDelete.id);
            onSelectedChange(selected.filter((x) => x !== toDelete.id));
            gooeyToast.success("Dokumen dihapus");
            router.refresh();
          } catch (e) {
            gooeyToast.error(errorMessage(e) ?? "Gagal menghapus dokumen");
          }
        }}
      />
    </div>
  );
}

// --- Promos --------------------------------------------------------------------------

const EMPTY_PROMO: PromoInput = { title: "", description: "", code: "", startsAt: "", endsAt: "", isActive: true };

export function PromoManager({ promos, enabled, onEnabledChange }: { promos: PromoItem[]; enabled: boolean; onEnabledChange: (v: boolean) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; v: PromoInput } | null>(null);
  const [toDelete, setToDelete] = useState<PromoItem | null>(null);
  const [pending, start] = useTransition();
  const running = promos.filter((p) => p.state === "berjalan").length;

  function save() {
    if (!editing) return;
    const { id, v } = editing;
    if (!v.title.trim()) return gooeyToast.error("Judul promo wajib diisi");
    if (v.startsAt && v.endsAt && v.startsAt > v.endsAt) return gooeyToast.error("Tanggal selesai harus setelah tanggal mulai");
    start(async () => {
      try {
        await savePromo(id, v);
        gooeyToast.success(id ? "Promo diperbarui" : "Promo ditambahkan");
        setEditing(null);
        router.refresh();
      } catch (e) {
        gooeyToast.error(errorMessage(e) ?? "Gagal menyimpan promo");
      }
    });
  }

  const set = <K extends keyof PromoInput>(k: K, x: PromoInput[K]) => setEditing((e) => (e ? { ...e, v: { ...e.v, [k]: x } } : e));

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <span className="min-w-0">
          <span className="block text-[13px] font-medium">Sebutkan promo</span>
          <span className="block text-[11px] text-muted-foreground">{running ? `${running} promo sedang berjalan` : "Hanya promo yang masih berlaku"}</span>
        </span>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </label>

      {enabled && (
        <div className="rounded-lg border border-border">
          {promos.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Belum ada promo. AI tidak akan mengarang promo.</p>
          ) : (
            <ul className="max-h-48 divide-y divide-border overflow-y-auto">
              {promos.map((p) => (
                <li key={p.id} className="group flex items-center gap-2 px-2.5 py-1.5">
                  <Tag className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{p.title}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {p.period}
                      {p.code && ` · ${p.code}`}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded px-1.5 text-[10px] font-medium", STATE_STYLE[p.state].cls)}>{STATE_STYLE[p.state].label}</span>
                  <button
                    type="button"
                    aria-label={`Edit ${p.title}`}
                    onClick={() => setEditing({ id: p.id, v: { title: p.title, description: p.description, code: p.code, startsAt: p.startsAt, endsAt: p.endsAt, isActive: p.isActive } })}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${p.title}`}
                    onClick={() => setToDelete(p)}
                    className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border p-1.5">
            <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => setEditing({ id: null, v: EMPTY_PROMO })}>
              <Plus className="size-3.5" /> Tambah promo
            </Button>
          </div>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !pending && !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit promo" : "Promo baru"}</DialogTitle>
            <DialogDescription>AI hanya menyebut promo yang aktif dan masih dalam periode. Zona waktu WIB.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Input value={editing.v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="Judul, mis. Diskon 20% semua kaos" className={inputCls} />
              <Textarea
                value={editing.v.description}
                maxLength={500}
                rows={3}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Detail & syarat, mis. min. belanja 100rb"
                className="w-full p-2.5 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Kode
                  <Input value={editing.v.code} maxLength={40} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="KAOS20" className={cn(inputCls, "mt-1 font-mono")} />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Mulai
                  <Input type="date" value={editing.v.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={cn(inputCls, "mt-1 px-2")} />
                </label>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Selesai
                  <Input type="date" value={editing.v.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={cn(inputCls, "mt-1 px-2")} />
                </label>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="text-[13px] font-medium">Promo aktif</span>
                <Switch checked={editing.v.isActive} onCheckedChange={(x) => set("isActive", x)} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>
              Batal
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Simpan promo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Hapus promo?"
        description={
          <>
            <b>{toDelete?.title}</b> dihapus permanen. AI berhenti menyebutnya.
          </>
        }
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deletePromo(toDelete.id);
            gooeyToast.success("Promo dihapus");
            router.refresh();
          } catch (e) {
            gooeyToast.error(errorMessage(e) ?? "Gagal menghapus promo");
          }
        }}
      />
    </div>
  );
}
