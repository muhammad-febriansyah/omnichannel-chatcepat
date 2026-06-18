import { TemplateForm } from "@/components/app/template-form";
import { requirePageAbility } from "@/lib/session";

export default async function NewTemplatePage() {
  await requirePageAbility("broadcast.manage");
  return <TemplateForm mode="create" />;
}
