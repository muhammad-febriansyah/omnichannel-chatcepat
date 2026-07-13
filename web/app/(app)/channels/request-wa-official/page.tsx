import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listMyWaRequests } from "@/lib/wa-requests";
import { Card, CardContent } from "@/components/ui/card";
import { WaRequestForm } from "@/components/app/wa-request-form";
import { MyWaRequestsTable } from "@/components/app/my-wa-requests-table";

export default async function RequestWaOfficialPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await requireSession();
  if (!can(session, "channel.connect")) notFound();
  if (!session.tenantId) notFound();

  const [{ submitted }, rows] = await Promise.all([searchParams, listMyWaRequests(session.tenantId)]);

  return (
    <div className="w-full p-6 sm:p-8">
      <Link
        href="/channels/connect"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Channel
      </Link>

      {submitted && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <div>
            <div className="font-semibold">Pengajuan terkirim.</div>
            Tim kami akan menyiapkan &amp; menghubungkan nomor WhatsApp Official-mu. Pantau statusnya di daftar bawah.
          </div>
        </div>
      )}

      <WaRequestForm />

      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold">Pengajuan Saya</h2>
        <Card>
          <CardContent className="pt-6">
            <MyWaRequestsTable rows={rows} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
