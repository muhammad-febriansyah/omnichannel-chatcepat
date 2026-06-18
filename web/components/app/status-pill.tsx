import { cn } from "@/lib/utils";

// Pill status seragam + dark-safe. Dipakai untuk badge opt-in, status percakapan, dll.
export type PillTone = "blue" | "amber" | "emerald" | "red" | "slate";

const TONES: Record<PillTone, string> = {
  blue: "bg-blue-50 text-brand-blue dark:bg-blue-500/10 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  red: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  slate: "bg-muted text-muted-foreground",
};

export function StatusPill({
  tone = "slate",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Penanda jujur: panel ini memakai data contoh (belum terhubung sumber asli).
export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
        className,
      )}
    >
      Data contoh
    </span>
  );
}
