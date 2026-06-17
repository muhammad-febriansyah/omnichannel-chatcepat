import { and, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { UsersTable, type UserRow } from "@/components/app/users-table";
import { PageHeader } from "@/components/app/page-header";

async function load(tenantId: string | null, selfId: string): Promise<UserRow[]> {
  if (!tenantId) return [];
  try {
    const rows = await db.query.users.findMany({
      where: and(eq(users.tenantId, tenantId), ne(users.role, "super_admin")),
      orderBy: [desc(users.createdAt)],
      limit: 200,
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      isSelf: u.id === selfId,
    }));
  } catch {
    return [];
  }
}

export default async function UsersPage() {
  const session = await requireSession();
  const rows = await load(session.tenantId, session.id);

  return (
    <div className="p-6">
      <PageHeader
        title="Tim"
        description={`${rows.length} anggota`}
        actions={
          <>
            <Link
              href="/settings/users/new"
              className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <UserPlus className="size-4" /> Undang Anggota
            </Link>
          </>
        }
      />

      <UsersTable rows={rows} />
    </div>
  );
}
