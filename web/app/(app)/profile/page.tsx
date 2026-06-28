import { eq } from "drizzle-orm";
import { User } from "lucide-react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireSession } from "@/lib/session";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm } from "@/components/app/profile-form";

export default async function ProfilePage() {
  const session = await requireSession();
  const me = await db.query.users.findFirst({ where: eq(users.id, session.id) });

  return (
    <div className="p-6">
      <PageHeader icon={User} title="Profil Saya" description="Kelola informasi akun dan foto profil kamu." />
      <ProfileForm
        initial={{
          name: me?.name ?? session.name,
          email: me?.email ?? session.email,
          role: me?.role ?? session.role,
          avatarUrl: me?.avatarUrl ?? null,
        }}
      />
    </div>
  );
}
