import type { ElementType } from "react";

// Header halaman seragam: ikon opsional + judul + deskripsi + slot aksi (kanan).
// Dipakai di semua list/detail page supaya hirarki & spacing konsisten.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: ElementType; // deprecated: ikon judul tak dirender lagi (hindari kesan templated)
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
