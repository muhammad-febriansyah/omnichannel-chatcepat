"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Package, Tag, Hash, Boxes, ImagePlus, Loader2, X, Star } from "lucide-react";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/app/action-link";
import { cn } from "@/lib/utils";
import { createProduct, updateProduct, type ProductInput } from "@/lib/actions";

const MAX_PHOTOS = 10;
const inputCls =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10";

type Initial = ProductInput;

export function ProductForm({
  mode,
  productId,
  initial,
}: {
  mode: "create" | "edit";
  productId?: string;
  initial?: Initial;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(String(initial?.priceIdr ?? ""));
  const [stock, setStock] = useState(String(initial?.stock ?? "0"));
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = mode === "edit";

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return gooeyToast.error(`Maksimal ${MAX_PHOTOS} foto`);
    setUploading(true);
    try {
      for (const file of files.slice(0, room)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/products/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal mengunggah foto");
        setPhotos((p) => [...p, data.url]);
      }
    } catch (err) {
      gooeyToast.error(err instanceof Error ? err.message : "Gagal mengunggah foto");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotos((p) => p.filter((x) => x !== url));
  }

  function makePrimary(url: string) {
    setPhotos((p) => [url, ...p.filter((x) => x !== url)]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return gooeyToast.error("Nama produk wajib diisi");
    const input: ProductInput = {
      name,
      description,
      priceIdr: Number(price) || 0,
      sku,
      stock: Number(stock) || 0,
      category,
      photos,
      active,
    };
    start(async () => {
      try {
        if (isEdit && productId) await updateProduct(productId, input);
        else await createProduct(input);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal menyimpan produk";
        if (!msg.includes("NEXT_REDIRECT")) gooeyToast.error(msg);
      }
    });
  }

  return (
    <div className="w-full p-6">
      <Link href="/products" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali ke Produk
      </Link>

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{isEdit ? "Edit Produk" : "Produk Baru"}</CardTitle>
            <CardDescription>
              Produk aktif dikirim otomatis saat pelanggan minta katalog & jadi acuan jawaban AI.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Foto */}
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Foto Produk</label>
              <div className="flex flex-wrap gap-3">
                {photos.map((url, i) => (
                  <div key={url} className="group relative size-24 overflow-hidden rounded-xl border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto produk upload tenant */}
                    <img src={url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-brand-blue/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        <Star className="size-2.5 fill-white" /> Utama
                      </span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/45 opacity-0 transition group-hover:opacity-100">
                      {i !== 0 && (
                        <button
                          type="button"
                          onClick={() => makePrimary(url)}
                          title="Jadikan foto utama"
                          className="grid size-7 place-items-center rounded-full bg-white/90 text-brand-navy hover:bg-white"
                        >
                          <Star className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        title="Hapus foto"
                        className="grid size-7 place-items-center rounded-full bg-white/90 text-danger hover:bg-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="grid size-24 place-items-center rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground transition hover:border-brand-blue/50 hover:text-brand-blue disabled:opacity-60"
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={onPick} />
              <p className="mt-1.5 text-xs text-muted-foreground">Maks {MAX_PHOTOS} foto, 2 MB/foto. Foto pertama = utama (dikirim duluan).</p>
            </div>

            {/* Nama */}
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Nama Produk</label>
              <div className="relative">
                <Package className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Kaos Polos Hitam" className={cn(inputCls, "pl-10")} />
              </div>
            </div>

            {/* Harga + Stok */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="price" className="mb-1.5 block text-sm font-medium text-foreground">Harga (Rp)</label>
                <input id="price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} placeholder="50000" className={inputCls} />
              </div>
              <div>
                <label htmlFor="stock" className="mb-1.5 block text-sm font-medium text-foreground">Stok</label>
                <div className="relative">
                  <Boxes className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="stock" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" className={cn(inputCls, "pl-10")} />
                </div>
              </div>
            </div>

            {/* SKU + Kategori */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sku" className="mb-1.5 block text-sm font-medium text-foreground">SKU / Kode <span className="text-muted-foreground">(opsional)</span></label>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="KAOS-HTM-01" className={cn(inputCls, "pl-10")} />
                </div>
              </div>
              <div>
                <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">Kategori <span className="text-muted-foreground">(opsional)</span></label>
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Pakaian" className={cn(inputCls, "pl-10")} />
                </div>
              </div>
            </div>

            {/* Deskripsi */}
            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">Deskripsi</label>
              <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Bahan katun combed 30s, nyaman dipakai harian." className="w-full rounded-lg border border-border bg-background p-3 text-sm outline-none transition-shadow focus:border-brand-blue focus:bg-card focus:ring-4 focus:ring-brand-blue/10" />
            </div>

            {/* Aktif */}
            <label className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-foreground">Produk aktif</span>
                <span className="block text-xs text-muted-foreground">Hanya produk aktif yang masuk katalog & jawaban AI.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setActive((v) => !v)}
                className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", active ? "bg-brand-blue" : "bg-muted-foreground/30")}
              >
                <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform", active ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </label>
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-border">
            <ActionLink href="/products" variant="outline" className="px-5">Batal</ActionLink>
            <Button type="submit" size="lg" disabled={pending || uploading} className="px-5">
              <Save className="size-4" /> {pending ? "Menyimpan…" : "Simpan Produk"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
