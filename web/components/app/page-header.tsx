import type { ElementType } from "react";

// Header halaman seragam: ikon opsional + judul + deskripsi + slot aksi (kanan).
// Dipakai di semua list/detail page supaya hirarki & spacing konsisten.
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: ElementType;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue/15 dark:text-brand-light">
            <Icon className="size-5" strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
