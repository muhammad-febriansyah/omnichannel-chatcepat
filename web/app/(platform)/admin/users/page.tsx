import { Users2 } from "lucide-react";
import { requireSession } from "@/lib/session";
import { roleLabel } from "@/lib/format";
import { listAllUsers, type PlatformUserRow } from "@/lib/platform-stats";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  invited: "bg-amber-100 text-amber-700",
  disabled: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  invited: "Diundang",
  disabled: "Nonaktif",
};

export default async function PlatformUsersPage() {
  await requireSession();
  const users = await listAllUsers(200);
  const active = users.filter((u) => u.status === "active").length;

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-brand-navy">
          <Users2 className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pengguna</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} pengguna · {active} aktif — seluruh tenant.
          </p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Belum ada pengguna.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Aktif Terakhir</th>
                <th className="px-4 py-3 font-semibold">Terdaftar</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: PlatformUserRow) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.tenantName ?? "— Platform"}</td>
                  <td className="px-4 py-3">{roleLabel(u.role)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[u.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {STATUS_LABEL[u.status] ?? u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.lastActiveAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
