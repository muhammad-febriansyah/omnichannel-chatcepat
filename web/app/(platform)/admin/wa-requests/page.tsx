import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAllWaRequests } from "@/lib/wa-requests";
import { Card, CardContent } from "@/components/ui/card";
import { WaRequestsTable } from "@/components/app/wa-requests-table";

export default async function AdminWaRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ assigned?: string }>;
}) {
  const session = await requireSession();
  if (!can(session, "tenant.manage")) notFound();

  const [{ assigned }, rows] = await Promise.all([searchParams, listAllWaRequests()]);
  const pending = rows.filter((r) => r.status === "pending" || r.status === "in_review").length;

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengajuan WhatsApp Official</h1>
          <p className="text-sm text-muted-foreground">
            Onboard nomor di panel provider, lalu assign ke tenant.
          </p>
        </div>
        {pending > 0 && (
          <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            {pending} perlu ditinjau
          </span>
        )}
      </div>

      {assigned && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0" />
          Nomor berhasil di-assign. Channel WhatsApp Official tenant sudah aktif.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <WaRequestsTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
