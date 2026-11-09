import { requirePageAbility } from "@/lib/session";
import { DocForm } from "@/components/app/knowledge/doc-form";

export default async function NewDocPage() {
  await requirePageAbility("knowledge.manage");
  return <DocForm />;
}
