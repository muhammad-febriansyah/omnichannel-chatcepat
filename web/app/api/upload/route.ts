import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { UPLOAD_DIR } from "@/lib/uploads";

export const runtime = "nodejs";

// POST /api/upload — terima file gambar (multipart), simpan ke UPLOAD_DIR/<tenantId>
// (persisten, di luar public/), balikkan { url } /uploads/<tenant>/<name>. Auth + tenant scope.
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.tenantId || !can(session, "billing.tenant")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file wajib diunggah" }, { status: 400 });
  }
  const ext = EXT[file.type];
  if (!ext) {
    return Response.json({ error: "Format harus PNG, JPG, WebP, SVG, GIF, atau ICO" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Ukuran maksimal 2 MB" }, { status: 413 });
  }

  const dir = path.join(UPLOAD_DIR, session.tenantId);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buf);

  return Response.json({ url: `/uploads/${session.tenantId}/${name}` });
}
