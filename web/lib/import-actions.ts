"use server";

// Products import from Excel/CSV (menu Produk → Import). Rows are mapped on the client
// (lib/table-import) and re-validated here; tenant id always comes from the session.

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { userError } from "@/lib/action-error";
import { db } from "./db";
import { products } from "./db/schema";
import { requireAbility } from "./rbac";
import { requireSession } from "./session";
import { requireFeature } from "./entitlements";
import { MAX_IMPORT_ROWS } from "./table-import";

const rowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priceIdr: z.number().int().min(0).max(1_000_000_000_000),
  stock: z.number().int().min(0).max(100_000_000),
  sku: z.string().trim().max(80),
  category: z.string().trim().max(80),
  description: z.string().trim().max(2000),
});

/** Same SKU as an existing product → that product is updated; otherwise a new one. */
export async function importProducts(items: z.infer<typeof rowSchema>[]): Promise<{ added: number; updated: number }> {
  const session = await requireSession();
  requireAbility(session, "product.manage");
  if (!session.tenantId) throw userError("Tenant tidak ditemukan");
  await requireFeature(session, "catalog", "Katalog Produk");
  const parsed = z
    .array(rowSchema)
    .min(1, "Tidak ada baris untuk diimpor")
    .max(MAX_IMPORT_ROWS, `Maksimal ${MAX_IMPORT_ROWS} baris sekali impor`)
    .safeParse(items);
  if (!parsed.success) throw userError(parsed.error.issues[0]?.message ?? "Data tidak valid");
  const tenantId = session.tenantId;
  const rows = parsed.data;

  const result = await db.transaction(async (tx) => {
    const skus = [...new Set(rows.map((r) => r.sku).filter(Boolean))];
    const existing = skus.length
      ? await tx
          .select({ id: products.id, sku: products.sku })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), inArray(products.sku, skus)))
      : [];
    const bySku = new Map(existing.map((p) => [p.sku as string, p.id]));
    let added = 0;
    let updated = 0;
    const inserts = [];
    for (const r of rows) {
      const values = {
        name: r.name,
        priceIdr: r.priceIdr,
        stock: r.stock,
        sku: r.sku || null,
        category: r.category || null,
        description: r.description || null,
      };
      const id = r.sku ? bySku.get(r.sku) : undefined;
      if (id) {
        await tx
          .update(products)
          .set({ ...values, updatedAt: sql`now()` })
          .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
        updated++;
      } else {
        inserts.push({ ...values, tenantId, photos: [], active: true });
        added++;
      }
    }
    if (inserts.length) await tx.insert(products).values(inserts);
    return { added, updated };
  });
  revalidatePath("/products");
  return result;
}
