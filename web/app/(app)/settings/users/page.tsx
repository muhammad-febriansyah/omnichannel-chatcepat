import { and, desc, eq, ne } from "drizzle-orm";
import { UserPlus, UsersRound } from "lucide-react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { UsersTable, type UserRow } from "@/components/app/users-table";
import { PageHeader } from "@/components/app/page-header";
import { ActionLink } from "@/components/app/action-link";

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
  const session = await requirePageAbility("user.manage");
  const rows = await load(session.tenantId, session.id);

  return (
    <div className="p-6">
      <PageHeader
        icon={UsersRound}
        title="Tim"
        description={`${rows.length} anggota`}
        actions={
          <ActionLink href="/settings/users/new">
            <UserPlus className="size-4" /> Undang Anggota
          </ActionLink>
        }
      />

      <UsersTable rows={rows} />
    </div>
  );
}
