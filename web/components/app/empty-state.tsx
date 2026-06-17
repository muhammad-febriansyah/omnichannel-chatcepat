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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
        <Icon className="size-6" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm px-4 text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
