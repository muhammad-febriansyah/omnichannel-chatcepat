import { UserForm } from "@/components/app/user-form";
import { requirePageAbility } from "@/lib/session";

export default async function NewUserPage() {
  await requirePageAbility("user.manage");
  return <UserForm mode="create" />;
}
