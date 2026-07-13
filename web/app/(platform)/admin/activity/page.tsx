import { requireSession } from "@/lib/session";
import { listAuditLogs } from "@/lib/platform-stats";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityTable } from "@/components/app/activity-table";

export default async function PlatformActivityPage() {
  await requireSession();
  const logs = await listAuditLogs(500);

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
        <p className="text-sm text-muted-foreground">Jejak aksi penting admin platform.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <ActivityTable rows={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
