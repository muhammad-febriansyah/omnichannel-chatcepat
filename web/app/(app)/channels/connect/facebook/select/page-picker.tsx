"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import Image from "next/image";
import { Check, Loader2, Plug } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { connectMetaPage } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "@/components/app/channel-icon";

export interface PickerPage {
  id: string;
  name: string;
  picture?: string;
}

export function PagePicker({ pages, platform }: { pages: PickerPage[]; platform: "facebook" | "instagram" }) {
  // Pra-pilih kalau cuma satu Page → satu klik selesai.
  const [selected, setSelected] = useState<string | null>(pages.length === 1 ? pages[0].id : null);
  const [pending, start] = useTransition();

  function connect() {
    if (!selected) {
      gooeyToast.error("Pilih satu Page dulu");
      return;
    }
    start(async () => {
      try {
        // connectMetaPage redirect ke /channels saat sukses (tak resolve normal).
        await connectMetaPage(selected);
      } catch (e) {
        // redirect() melempar NEXT_REDIRECT (bukan error) → biarkan Next yang handle.
        unstable_rethrow(e);
        gooeyToast.error(e instanceof Error ? e.message : "Gagal menghubungkan Page");
      }
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2.5">
        {pages.map((p) => {
          const active = selected === p.id;
          return (
            <li key={p.id}>
              <button
                onClick={() => setSelected(p.id)}
                disabled={pending}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200",
                  active
                    ? "border-brand-blue bg-blue-50/70 ring-1 ring-brand-blue/20 dark:bg-blue-500/10"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-brand-blue/40 hover:shadow-md",
                )}
              >
                <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1877f2] text-white ring-1 ring-black/5">
                  {p.picture ? (
                    <Image src={p.picture} alt="" fill sizes="44px" className="object-cover" unoptimized />
                  ) : (
                    <ChannelIcon type={platform} className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">ID: {p.id}</div>
                </div>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full transition-all",
                    active ? "scale-100 bg-brand-blue text-white" : "scale-0 bg-muted",
                  )}
                >
                  <Check className="size-3" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button onClick={connect} disabled={pending || !selected} size="lg" className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
        {pending ? "Menghubungkan…" : "Hubungkan Page"}
      </Button>
    </div>
  );
}
