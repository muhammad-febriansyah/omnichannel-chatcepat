import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { Plus, Pencil, Package } from "lucide-react";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { rupiah } from "@/lib/format";
import { deletePlan } from "@/lib/billing-actions";
import { PageHeader } from "@/components/app/page-header";
import { ActionLink } from "@/components/app/action-link";
import { StatusPill, type PillTone } from "@/components/app/status-pill";
import { DeleteButton } from "@/components/app/delete-button";

const TIER_LABEL: Record<string, string> = {
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};
const TIER_TONE: Record<string, PillTone> = {
  pro: "blue",
  business: "amber",
  enterprise: "emerald",
};

export default async function PlansPage() {
  const session = await requireSession();
  if (!can(session, "tenant.manage")) notFound();

  const rows = await db.query.plans.findMany({ orderBy: [asc(plans.sortOrder)] });

  return (
    <div className="p-6 sm:p-8">
      <PageHeader
        icon={Package}
        title="Paket Harga"
        description={`${rows.length} paket · pricing global SaaS untuk seluruh tenant`}
        actions={
          <ActionLink href="/admin/plans/new">
            <Plus className="size-4" /> Paket Baru
          </ActionLink>
        }
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Package className="size-6" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-foreground">Belum ada paket</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Buat paket harga pertama untuk ditampilkan di halaman pricing.
          </p>
          <ActionLink href="/admin/plans/new" className="mt-5">
            <Plus className="size-4" /> Paket Baru
          </ActionLink>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Harga</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Kuota</th>
                  <th className="px-4 py-3">Aktif?</th>
                  <th className="px-4 py-3">Highlight?</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={TIER_TONE[p.tier] ?? "slate"}>{TIER_LABEL[p.tier] ?? p.tier}</StatusPill>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {p.priceIdr > 0 ? rupiah(p.priceIdr) : <span className="text-muted-foreground">Hubungi kami</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.period === "year" ? "Tahunan" : "Bulanan"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.quota == null ? "Unlimited" : p.quota.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={p.isActive ? "emerald" : "slate"}>{p.isActive ? "Aktif" : "Nonaktif"}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      {p.highlight ? <StatusPill tone="amber">Populer</StatusPill> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ActionLink
                          href={`/admin/plans/${p.id}/edit`}
                          variant="ghost"
                          size="sm"
                          aria-label="Edit paket"
                          title="Edit paket"
                          className="size-8 p-0"
                        >
                          <Pencil className="size-4" />
                        </ActionLink>
                        <DeleteButton
                          onConfirm={deletePlan.bind(null, p.id)}
                          title="Hapus paket?"
                          description={
                            <>
                              Paket <b>{p.name}</b> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
                            </>
                          }
                          successMessage="Paket dihapus"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
