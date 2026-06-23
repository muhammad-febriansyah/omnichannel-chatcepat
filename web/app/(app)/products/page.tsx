import { and, desc, eq } from "drizzle-orm";
import { Plus, Package, PackageOpen, ImageOff } from "lucide-react";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { requirePageAbility } from "@/lib/session";
import { deleteProduct } from "@/lib/actions";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DeleteButton } from "@/components/app/delete-button";
import { ActionLink } from "@/components/app/action-link";
import { EditButton } from "@/components/app/action-button";
import { StatusPill } from "@/components/app/status-pill";

function rupiah(n: number): string {
  return "Rp" + (n ?? 0).toLocaleString("id-ID");
}

async function load(tenantId: string | null) {
  if (!tenantId) return [];
  try {
    return await db.query.products.findMany({
      where: and(eq(products.tenantId, tenantId)),
      orderBy: [desc(products.createdAt)],
      limit: 300,
    });
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const session = await requirePageAbility("product.manage");
  const rows = await load(session.tenantId);

  return (
    <div className="p-6">
      <PageHeader
        icon={Package}
        title="Produk"
        description={`${rows.length} produk · dikirim otomatis saat pelanggan minta katalog`}
        actions={
          <ActionLink href="/products/new">
            <Plus className="size-4" /> Produk Baru
          </ActionLink>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="Belum ada produk"
          description="Tambah produk beserta foto & harga. Pelanggan ketik 'katalog' → produk terkirim otomatis."
          action={
            <ActionLink href="/products/new">
              <Plus className="size-4" /> Tambah produk pertama
            </ActionLink>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((p) => {
            const photo = p.photos?.[0];
            return (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                <div className="relative aspect-[4/3] bg-muted">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto produk upload tenant
                    <img src={photo} alt={p.name} className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground/40">
                      <ImageOff className="size-8" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex gap-1.5">
                    {!p.active && <StatusPill tone="slate">Nonaktif</StatusPill>}
                    {p.stock <= 0 && <StatusPill tone="red">Stok habis</StatusPill>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-semibold">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-brand-blue">{rupiah(p.priceIdr)}</span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {p.category && <StatusPill tone="slate">{p.category}</StatusPill>}
                    <span>Stok {p.stock}</span>
                    {p.sku && <span>· {p.sku}</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-end gap-1.5 pt-2">
                    <EditButton href={`/products/${p.id}/edit`} />
                    <DeleteButton
                      onConfirm={deleteProduct.bind(null, p.id)}
                      title="Hapus produk?"
                      description={
                        <>
                          Produk <span className="font-semibold text-foreground">{p.name}</span> beserta fotonya akan dihapus permanen.
                        </>
                      }
                      successMessage="Produk dihapus"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
