import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { ProductForm } from "@/components/app/product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePageAbility("product.manage");
  const { id } = await params;
  if (!session.tenantId) notFound();

  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.tenantId, session.tenantId)));
  if (!row) notFound();

  return (
    <ProductForm
      mode="edit"
      productId={row.id}
      initial={{
        name: row.name,
        description: row.description,
        priceIdr: row.priceIdr,
        sku: row.sku,
        stock: row.stock,
        category: row.category,
        photos: row.photos ?? [],
        active: row.active,
      }}
    />
  );
}
