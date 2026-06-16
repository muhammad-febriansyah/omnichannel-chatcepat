import { and, desc, eq } from "drizzle-orm";
import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { getSession } from "@/lib/session";
import { initials } from "@/lib/format";

const OPTIN: Record<string, { label: string; cls: string }> = {
  opted_in: { label: "Opted-in", cls: "bg-emerald-50 text-emerald-700" },
  opted_out: { label: "Opted-out", cls: "bg-red-50 text-red-700" },
  unknown: { label: "Unknown", cls: "bg-slate-100 text-slate-600" },
};

async function load(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.contacts.findMany({
      where: and(eq(contacts.tenantId, tenantId)),
      orderBy: [desc(contacts.createdAt)],
      limit: 50,
    });
  } catch {
    return [];
  }
}

export default async function ContactsPage() {
  const session = await getSession();
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kontak</h1>
          <p className="text-sm text-muted-foreground">{rows.length} kontak</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/contacts/import"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <Upload className="size-4" /> Import
          </Link>
          <Link
            href="/contacts/new"
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" /> Kontak Baru
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nama</th>
              <th className="px-4 py-3 font-medium">Telepon</th>
              <th className="px-4 py-3 font-medium">Opt-in</th>
              <th className="px-4 py-3 font-medium">Sumber</th>
              <th className="px-4 py-3 font-medium">Tag</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Belum ada kontak. Tambah atau import dulu.
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const o = OPTIN[c.optInStatus ?? "unknown"] ?? OPTIN.unknown;
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-navy to-brand-blue text-[11px] font-semibold text-white">
                          {initials(c.name)}
                        </div>
                        <span className="font-medium">{c.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${o.cls}`}>
                        {o.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.optInSource ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(Array.isArray(c.tags) ? c.tags : []).slice(0, 3).map((t: string) => (
                          <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
