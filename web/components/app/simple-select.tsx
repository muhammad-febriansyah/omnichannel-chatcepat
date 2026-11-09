"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; icon?: React.ReactNode };

// shadcn Select with a plain options list. "" = nothing selected (shows placeholder).
export function SimpleSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  className,
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(v) => onChange(v == null ? "" : String(v))}
      items={options}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("h-10 w-full bg-background", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.icon ? (
              <span className="flex items-center gap-2">
                {o.icon}
                {o.label}
              </span>
            ) : (
              o.label
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
