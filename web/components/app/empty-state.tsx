import type { LucideIcon } from "lucide-react";

// Empty state seragam: ikon + judul + deskripsi + aksi opsional.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-card py-20 text-center">
      {/* halo dekoratif lembut */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 left-1/2 size-48 -translate-x-1/2 rounded-full bg-brand-blue/10 blur-3xl"
      />
      <div className="relative flex size-16 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue/15 ring-offset-2 ring-offset-card dark:text-brand-light">
        <Icon className="size-7" strokeWidth={1.75} />
      </div>
      <p className="relative mt-4 text-base font-semibold text-foreground">{title}</p>
      {description && <p className="relative mt-1.5 max-w-sm px-4 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}
