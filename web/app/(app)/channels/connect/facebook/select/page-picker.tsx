"use client";

import { errorMessage } from "@/lib/action-error";
import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { AlertCircle, Check, Loader2, Plug } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { connectMetaPage } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "@/components/app/channel-icon";

export interface PickerPage {
  id: string;
  name: string;
  picture?: string;
  ig: { username: string | null; name: string | null; picture: string | null } | null;
  // available = can connect; here = already in this workspace; elsewhere = linked to
  // another workspace; no_ig = Page has no Instagram professional account linked.
  status: "available" | "here" | "elsewhere" | "no_ig";
}

const STATUS: Record<Exclude<PickerPage["status"], "available">, { label: string; hint: string; cls: string }> = {
  here: {
    label: "Sudah terhubung",
    hint: "Pilih untuk menghubungkan ulang (memperbarui izin & token).",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  elsewhere: {
    label: "Dipakai workspace lain",
    hint: "Satu akun hanya bisa terhubung ke satu workspace. Putuskan dulu di workspace tersebut.",
    cls: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  no_ig: {
    label: "Belum tertaut Instagram",
    hint: "Tautkan akun Instagram Professional ke Page ini di Meta Business Suite.",
    cls: "bg-muted text-muted-foreground",
  },
};

function Avatar({ src, fallback, className }: { src?: string | null; fallback: React.ReactNode; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Meta CDN avatar, short-lived URL
        <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        fallback
      )}
    </span>
  );
}

export function PagePicker({ pages, platform }: { pages: PickerPage[]; platform: "facebook" | "instagram" }) {
  // "here" = already in this workspace: selectable to reconnect (refresh token).
  const selectable = (p: PickerPage) => p.status === "available" || p.status === "here";
  const available = pages.filter(selectable);
  // Only one account to choose → preselect it, one click to finish.
  const [selected, setSelected] = useState<string | null>(available.length === 1 ? available[0].id : null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isIg = platform === "instagram";

  function connect() {
    if (!selected) {
      setError("Pilih satu akun dulu.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        // connectMetaPage redirects to /channels on success (never resolves normally).
        await connectMetaPage(selected);
      } catch (e) {
        // redirect() throws NEXT_REDIRECT (not an error) → let Next handle it.
        unstable_rethrow(e);
        const msg = errorMessage(e) ?? "Gagal menghubungkan akun. Coba lagi.";
        setError(msg);
        gooeyToast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {pages.length} {isIg ? "akun ditemukan" : "Page ditemukan"}
      </p>

      <ul className="space-y-2.5" role="radiogroup" aria-label={isIg ? "Akun Instagram" : "Facebook Page"}>
        {pages.map((p) => {
          const active = selected === p.id;
          const disabled = !selectable(p) || pending;
          const meta = p.status === "available" ? null : STATUS[p.status];
          const title = isIg ? (p.ig?.username ? `@${p.ig.username}` : p.ig?.name ?? p.name) : p.name;
          return (
            <li key={p.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setSelected(p.id);
                  setError(null);
                }}
                disabled={disabled}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all duration-200",
                  active
                    ? "border-brand-blue bg-blue-50/70 ring-2 ring-brand-blue/15 dark:bg-blue-500/10"
                    : "border-border bg-card",
                  selectable(p) && !active && "hover:border-brand-blue/40 hover:bg-muted/40",
                  !selectable(p) && "cursor-not-allowed opacity-75",
                )}
              >
                <span className="relative">
                  <Avatar
                    src={isIg ? p.ig?.picture : p.picture}
                    fallback={<ChannelIcon type={platform} className="size-5" />}
                    className={cn("size-12", isIg && p.ig && "ring-2 ring-[#d62976]/40 ring-offset-2 ring-offset-card")}
                  />
                  {isIg && (
                    <Avatar
                      src={p.picture}
                      fallback={<ChannelIcon type="facebook" className="size-3" />}
                      className="absolute -bottom-1 -right-1 size-5 ring-2 ring-card"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {isIg ? `Page: ${p.name}` : `ID ${p.id}`}
                  </span>
                  {meta && (
                    <span className="mt-1.5 flex flex-col gap-1">
                      <span className={cn("w-fit rounded-full px-2 py-0.5 text-[11px] font-medium", meta.cls)}>{meta.label}</span>
                      <span className="text-[11.5px] leading-snug text-muted-foreground">{meta.hint}</span>
                    </span>
                  )}
                </span>
                {selectable(p) && (
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      active ? "border-brand-blue bg-brand-blue text-white" : "border-border",
                    )}
                  >
                    {active && <Check className="size-3" strokeWidth={3} />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {available.length === 0 ? (
        <p className="rounded-xl bg-muted/60 p-3.5 text-sm text-muted-foreground">
          Belum ada akun yang bisa dihubungkan. Lihat keterangan di setiap akun di atas.
        </p>
      ) : (
        <Button onClick={connect} disabled={pending || !selected} size="lg" className="h-11 w-full">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
          {pending
            ? "Menghubungkan…"
            : pages.find((p) => p.id === selected)?.status === "here"
              ? "Hubungkan ulang"
              : isIg
                ? "Hubungkan Instagram"
                : "Hubungkan Page"}
        </Button>
      )}
    </div>
  );
}
