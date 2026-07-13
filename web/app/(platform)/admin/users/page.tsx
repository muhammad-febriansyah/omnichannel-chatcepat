import { requireSession } from "@/lib/session";
import { listAllUsers } from "@/lib/platform-stats";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformUsersTable } from "@/components/app/platform-users-table";

export default async function PlatformUsersPage() {
  await requireSession();
  const users = await listAllUsers(500);
  const active = users.filter((u) => u.status === "active").length;

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Pengguna</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} pengguna · {active} aktif — seluruh tenant.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <PlatformUsersTable rows={users} />
        </CardContent>
      </Card>
    </div>
  );
}
