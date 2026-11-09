import { requirePageAbility } from "@/lib/session";
import { TableImport } from "@/components/app/knowledge/table-import";

export default async function ImportProductsPage() {
  await requirePageAbility("product.manage");
  return <TableImport kind="products" />;
}
