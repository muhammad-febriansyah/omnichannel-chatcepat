import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getWaRequest, listClaimedWaExternalIds } from "@/lib/wa-requests";
import { WaAssignForm } from "@/components/app/wa-assign-form";

export default async function AdminWaRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!can(session, "tenant.manage")) notFound();

  const { id } = await params;
  const [request, claimed] = await Promise.all([getWaRequest(id), listClaimedWaExternalIds()]);
  if (!request) notFound();

  return (
    <div className="w-full p-6 sm:p-8">
      <Link
        href="/admin/wa-requests"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke Pengajuan
      </Link>
      <WaAssignForm request={request} claimed={claimed} />
    </div>
  );
}
