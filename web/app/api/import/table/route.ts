import { errorMessage } from "@/lib/action-error";
import { requireSession } from "@/lib/session";
import { requireAbility } from "@/lib/rbac";
import { enginePost, MAX_UPLOAD_BYTES } from "@/lib/engine-call";

export const runtime = "nodejs";

// POST /api/import/table — read a CSV/Excel file for the import preview (nothing is saved).
// multipart: file, purpose ("products" | "faqs").
export async function POST(request: Request) {
  const session = await requireSession();
  const form = await request.formData();
  const purpose = form.get("purpose") === "products" ? "products" : "faqs";
  requireAbility(session, purpose === "products" ? "product.manage" : "knowledge.manage");
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Pilih file dulu" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "File maksimal 10 MB" }, { status: 400 });
  try {
    const data = await enginePost<{ columns: string[]; rows: string[][] }>("/files/table", session.role, {
      filename: file.name.slice(0, 200),
      content_b64: Buffer.from(await file.arrayBuffer()).toString("base64"),
      purpose,
    });
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: errorMessage(err) ?? "Gagal membaca file" }, { status: 400 });
  }
}
