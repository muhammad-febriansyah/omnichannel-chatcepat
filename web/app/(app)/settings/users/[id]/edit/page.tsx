import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { UserForm } from "@/components/app/user-form";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePageAbility("user.manage");
  if (!session.tenantId) notFound();

  const u = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.tenantId, session.tenantId)),
  });
  if (!u || u.role === "super_admin") notFound();

  return (
    <UserForm
      mode="edit"
      userId={u.id}
      initial={{
        name: u.name,
        email: u.email,
        role: (u.role === "admin" || u.role === "supervisor" ? u.role : "agent") as "admin" | "supervisor" | "agent",
        status: u.status,
      }}
    />
  );
}
