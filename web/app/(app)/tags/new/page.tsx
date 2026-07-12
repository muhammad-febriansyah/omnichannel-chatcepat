import { TagForm } from "@/components/app/tag-form";
import { requirePageAbility } from "@/lib/session";

export default async function NewTagPage() {
  await requirePageAbility("contact.manage");
  return <TagForm mode="create" />;
}
