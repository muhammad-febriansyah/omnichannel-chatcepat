import Link from "next/link";
import { AlertTriangle, Clock, ArrowRight } from "lucide-react";

// Banner reminder langganan (muncul H-7 s/d berakhir). Data dari session
// (plan_expires_at). Expired → fitur efektif turun ke Basic (lihat session.ts).
export function PlanExpiryBanner({
  expiresAt,
  expired,
}: {
  expiresAt: string | null;
  expired: boolean;
}) {
  if (!expiresAt) return null;
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (!expired && daysLeft > 7) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-6 py-2.5 text-sm ${
        expired
          ? "border-red-200 bg-red-50 text-danger dark:border-red-500/30 dark:bg-red-500/10"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      }`}
    >
      {expired ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <Clock className="size-4 shrink-0" />
      )}
      <span className="font-medium">
        {expired
          ? "Langganan berakhir — fitur turun ke paket Basic."
          : `Langganan habis dalam ${daysLeft} hari.`}
      </span>
      <Link
        href="/billing"
        className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
      >
        Perpanjang sekarang <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
