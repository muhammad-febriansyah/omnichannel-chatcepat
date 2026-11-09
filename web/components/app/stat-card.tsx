import type { ElementType } from "react";
import { Sparkline } from "@/components/app/charts";
import { cn } from "@/lib/utils";

// KPI card (omnexa style): label top-left, round tinted icon top-right, big value,
// then a small caption. No "% vs yesterday" claims, so small data sets don't mislead.
export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "#2547F9",
  spark,
  hint,
  delta,
}: {
  icon: ElementType;
  label: string;
  value: string;
  tone?: string;
  spark?: number[];
  hint?: React.ReactNode; // small line under the value, e.g. "Real-time"
  delta?: number | null; // % vs previous period (null = new, undefined = hidden)
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="truncate pt-1 text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: `${tone}14`, color: tone }}>
          <Icon className="size-[18px]" strokeWidth={1.9} />
        </span>
      </div>
      <div>
        <div className="text-[28px] font-bold leading-none tracking-tight text-foreground tabular-nums">{value}</div>
        {delta !== undefined && (
          <div
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
              delta === null || delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-muted-foreground",
            )}
          >
            {delta === null ? "Baru" : delta > 0 ? `↗ +${delta}%` : delta < 0 ? `↘ ${delta}%` : "Stabil"}
            <span className="font-normal text-muted-foreground">vs periode sebelumnya</span>
          </div>
        )}
        {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      {spark && <Sparkline data={spark} color={tone} />}
    </div>
  );
}

// Several numbers in ONE card separated by thin dividers (omnexa "Lead masuk |
// Sedang diproses | Closing" style). Use for compact summaries above a table.
export function StatGroup({
  items,
  className,
}: {
  items: { label: string; value: string; hint?: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" }[];
  className?: string;
}) {
  const toneCls = { default: "text-foreground", success: "text-emerald-600", warning: "text-amber-600", danger: "text-red-600" };
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-[20px] bg-card",
        items.length >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : items.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
        "divide-y divide-border sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="min-w-0 p-5">
          <p className="truncate text-[13px] font-medium text-muted-foreground">{it.label}</p>
          <p className={cn("mt-2 text-2xl font-bold tabular-nums", toneCls[it.tone ?? "default"])}>{it.value}</p>
          {it.hint && <p className="mt-1.5 text-xs text-muted-foreground">{it.hint}</p>}
        </div>
      ))}
    </div>
  );
}
