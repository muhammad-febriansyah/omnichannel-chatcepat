"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const RANGES = [
  { id: "today", label: "Hari Ini" },
  { id: "7d", label: "7 Hari Terakhir" },
  { id: "30d", label: "30 Hari Terakhir" },
  { id: "ytd", label: "Tahun Berjalan" },
];

export function DateRangePicker() {
  const [range, setRange] = useState("7d");
  const [open, setOpen] = useState(false);
  const current = RANGES.find((r) => r.id === range)!;

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-brand-blue"
      >
        <Calendar className="size-4" />
        <span>{current.label}</span>
        <ChevronDown className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[200px] rounded-xl border border-border bg-card p-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setRange(r.id);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                r.id === range ? "bg-blue-100 font-semibold text-brand-navy" : "text-foreground hover:bg-slate-100",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
