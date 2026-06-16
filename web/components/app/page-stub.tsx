import { Construction } from "lucide-react";

export function PageStub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-warning">
          <Construction className="size-6" />
        </div>
        <p className="mt-3 text-sm font-medium">Modul sedang dibangun</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Backend (engine) sudah siap. Halaman UI menyusul.
        </p>
      </div>
    </div>
  );
}
