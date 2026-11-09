import { requirePageAbility } from "@/lib/session";
import { TableImport } from "@/components/app/knowledge/table-import";

export default async function ImportFaqsPage() {
  await requirePageAbility("knowledge.manage");
  return <TableImport kind="faqs" />;
}
