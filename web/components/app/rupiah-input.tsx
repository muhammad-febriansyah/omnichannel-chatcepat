"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Rupiah amount field: "Rp" prefix, thousands dots while typing (50.000), whole rupiah only.
// value null = empty field.
export function RupiahInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rp</span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value === null ? "" : value.toLocaleString("id-ID")}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "").slice(0, 15);
          onChange(digits ? Number(digits) : null);
        }}
        className={cn("pl-10 tabular-nums", className)}
      />
    </div>
  );
}
