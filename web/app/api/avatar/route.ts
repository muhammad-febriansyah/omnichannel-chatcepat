import { requireSession } from "@/lib/session";
import { saveImage } from "@/lib/uploads";

export const runtime = "nodejs";

// POST /api/avatar — unggah foto profil (multipart). Semua user login boleh (self-service),
// simpan ke UPLOAD_DIR/<tenantId>/ (super_admin tanpa tenant → "_platform"). Balikkan { url }.
export async function POST(request: Request) {
  const session = await requireSession();

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file wajib diunggah" }, { status: 400 });
  }

  try {
    const segment = session.tenantId ?? "_platform";
    const url = await saveImage(file, segment);
    return Response.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal mengunggah";
    return Response.json({ error: msg }, { status: 400 });
  }
}
