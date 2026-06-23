import { ProductForm } from "@/components/app/product-form";
import { requirePageAbility } from "@/lib/session";

export default async function NewProductPage() {
  await requirePageAbility("product.manage");
  return <ProductForm mode="create" />;
}
