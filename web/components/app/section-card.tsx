import { cn } from "@/lib/utils";

// Kartu seksi seragam: judul + deskripsi + slot aksi (kanan) + isi.
// Menyatukan tampilan semua panel (tabel tim, aktivitas, daftar, dll).
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("px-5 pb-5 pt-4 sm:px-6", contentClassName)}>{children}</div>
    </section>
  );
}
