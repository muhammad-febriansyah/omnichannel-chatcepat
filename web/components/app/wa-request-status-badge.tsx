import type { WaRequestStatus } from "@/lib/wa-requests";

const MAP: Record<WaRequestStatus, { label: string; cls: string; dot: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", dot: "bg-amber-500" },
  in_review: { label: "Ditinjau", cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300", dot: "bg-blue-500" },
  approved: { label: "Aktif", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", dot: "bg-emerald-500" },
  rejected: { label: "Ditolak", cls: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300", dot: "bg-red-500" },
};

export function WaRequestStatusBadge({ status }: { status: WaRequestStatus }) {
  const s = MAP[status] ?? MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
