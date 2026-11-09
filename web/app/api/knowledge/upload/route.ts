import { errorMessage } from "@/lib/action-error";
import { requireSession } from "@/lib/session";
import { requireAbility } from "@/lib/rbac";
import { assertCanAddKb } from "@/lib/entitlements";
import { enginePost, MAX_UPLOAD_BYTES } from "@/lib/engine-call";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

// POST /api/knowledge/upload — PDF / Word / TXT → knowledge document (multipart: file, title).
export async function POST(request: Request) {
  const session = await requireSession();
  requireAbility(session, "knowledge.manage");
  if (!session.tenantId) return Response.json({ error: "Tenant tidak ditemukan" }, { status: 400 });
  try {
    await assertCanAddKb(session);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Pilih file dulu" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "File maksimal 10 MB" }, { status: 400 });
    const title = String(form.get("title") ?? "").trim().slice(0, 120);
    const data = await enginePost<{ chunks: number; chars: number }>("/knowledge/file", session.role, {
      tenant_id: session.tenantId,
      title,
      filename: file.name.slice(0, 200),
      content_b64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    }, 120_000);
    revalidatePath("/flows");
    return Response.json({ ok: true, ...data });
  } catch (err) {
    return Response.json({ error: errorMessage(err) ?? "Gagal memproses file" }, { status: 400 });
  }
}
