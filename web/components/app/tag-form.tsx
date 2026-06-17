"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Tag as TagIcon, Check } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createTag, updateTag } from "@/lib/actions";

export const TAG_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#64748b",
  "#1e2a78",
];

export function TagForm({
  mode,
  tagId,
  initial,
}: {
  mode: "create" | "edit";
  tagId?: string;
  initial?: { name: string; color: string };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color || TAG_COLORS[0]);
  const [pending, start] = useTransition();
  const isEdit = mode === "edit";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return gooeyToast.error("Nama tag wajib diisi");
    start(async () => {
      try {
        if (isEdit && tagId) await updateTag(tagId, { name, color });
        else await createTag({ name, color });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan tag";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <div className="w-full p-6">
      <Link href="/tags" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Tag
      </Link>

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{isEdit ? "Edit Tag" : "Tag Baru"}</CardTitle>
            <CardDescription>Label untuk segmentasi kontak (broadcast & filter inbox).</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Nama Tag</label>
              <div className="relative">
                <TagIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VIP, Reseller, Jakarta…"
                  className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Warna</label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Warna ${c}`}
                    className={cn(
                      "grid size-8 place-items-center rounded-full transition",
                      color === c ? "ring-2 ring-offset-2" : "hover:scale-110",
                    )}
                    style={{ background: c, "--tw-ring-color": c } as React.CSSProperties}
                  >
                    {color === c && <Check className="size-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <span className="mb-1.5 block text-xs text-muted-foreground">Pratinjau</span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
                style={{ background: `${color}1a`, color }}
              >
                <span className="size-2 rounded-full" style={{ background: color }} />
                {name.trim() || "Nama tag"}
              </span>
            </div>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border">
            <Link href="/tags" className="flex h-11 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium hover:bg-slate-50">
              Batal
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="flex h-11 items-center gap-2 rounded-lg bg-brand-blue px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Tag"}
            </button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
