import type { ElementType } from "react";
import { Sparkline } from "@/components/app/charts";

// Kartu KPI seragam. Nilai = angka asli; sparkline = tren ringan (opsional, dekoratif).
// Sengaja tanpa klaim "% dari kemarin" supaya tidak menyesatkan saat data masih sedikit.
export function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  spark,
}: {
  icon: ElementType;
  label: string;
  value: string;
  tone: string;
  spark?: number[];
}) {
  return (
    <div className="group/stat relative flex flex-col gap-1 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      {/* aksen warna lembut di pojok, intensif saat hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover/stat:opacity-100"
        style={{ background: `${tone}24` }}
      />
      <div className="mb-2 flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-xl" style={{ background: `${tone}1F`, color: tone }}>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        {spark && <Sparkline data={spark} color={tone} />}
      </div>
      <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold tracking-tight text-brand-navy dark:text-foreground">{value}</div>
    </div>
  );
}
