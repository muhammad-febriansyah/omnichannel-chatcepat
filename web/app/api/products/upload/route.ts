import { requireSession } from "@/lib/session";
import { requireAbility } from "@/lib/rbac";
import { saveImage } from "@/lib/uploads";

export const runtime = "nodejs";

// POST /api/products/upload — unggah foto produk (multipart). RBAC product.manage.
// Simpan ke UPLOAD_DIR/<tenantId>/products/. Balikkan { url }.
export async function POST(request: Request) {
  const session = await requireSession();
  requireAbility(session, "product.manage");
  if (!session.tenantId) {
    return Response.json({ error: "Tenant tidak ditemukan" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file wajib diunggah" }, { status: 400 });
  }

  try {
    const url = await saveImage(file, `${session.tenantId}/products`);
    return Response.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal mengunggah";
    return Response.json({ error: msg }, { status: 400 });
  }
}
