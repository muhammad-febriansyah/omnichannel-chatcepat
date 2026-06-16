import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { db } from "@/lib/db";
import { flows } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { createFlow } from "@/lib/actions";

async function load(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.flows.findMany({
      where: eq(flows.tenantId, tenantId),
      orderBy: [desc(flows.createdAt)],
    });
  } catch {
    return [];
  }
}

export default async function FlowsPage() {
  const session = await requireSession();
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Otomasi</h1>
          <p className="text-sm text-muted-foreground">{rows.length} flow</p>
        </div>
        <form action={createFlow}>
          <button className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90">
            <Plus className="size-4" /> Flow Baru
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue">
            <Workflow className="size-6" />
          </div>
          <p className="mt-3 text-sm font-medium">Belum ada flow</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((f) => (
            <Link
              key={f.id}
              href={`/flows/${f.id}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{f.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${f.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {f.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Trigger: {f.trigger}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
