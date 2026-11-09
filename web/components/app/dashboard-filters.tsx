"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Opt = { id: string; label: string };

// Range + channel filter for the dashboard. Values go into the URL (?range=&ch=) and
// the server whitelists them again (lib/tenant-dashboard parseFilters).
export function DashboardFilters({ ranges, channels, range, channel }: { ranges: Opt[]; channels: Opt[]; range: string; channel: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const go = (key: "range" | "ch", value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Memuat" />}
      <div role="group" aria-label="Rentang waktu" className="inline-flex rounded-lg border border-border bg-card p-0.5">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.id === range}
            onClick={() => go("range", r.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              r.id === range ? "bg-brand-blue text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="w-40">
        <NativeSelect aria-label="Filter channel" value={channel ?? ""} onChange={(e) => go("ch", e.target.value || null)} className="h-9 text-xs">
          <NativeSelectOption value="">Semua channel</NativeSelectOption>
          {channels.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
