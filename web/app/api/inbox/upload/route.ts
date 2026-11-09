import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { UPLOAD_DIR } from "@/lib/uploads";
import { CHAT_MAX_BYTES, CHAT_MIME, formatBytes } from "@/lib/chat-attachments";

export const runtime = "nodejs";

// POST /api/inbox/upload — lampiran chat (gambar, video, audio, dokumen) untuk dikirim
// ke pelanggan. Disimpan di UPLOAD_DIR/<tenant>/chat/<uuid>.<ext> dan disajikan publik
// lewat /uploads/... (Meta/Telegram/WhatsApp mengambil file dari URL ini).
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.tenantId || !can(session, "conversation.takeover")) {
    return Response.json({ error: "Anda tidak punya akses mengirim file" }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "File wajib diunggah" }, { status: 400 });

  const entry = CHAT_MIME[file.type];
  if (!entry) {
    return Response.json({ error: "Format file tidak didukung. Kirim gambar, video, audio, PDF, Office, TXT/CSV, atau ZIP." }, { status: 415 });
  }
  const [ext, kind] = entry;
  if (file.size > CHAT_MAX_BYTES[kind]) {
    return Response.json({ error: `Ukuran maksimal ${formatBytes(CHAT_MAX_BYTES[kind])} untuk file ini` }, { status: 413 });
  }

  const dir = path.join(UPLOAD_DIR, session.tenantId, "chat");
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  // Original name for display / document filename (path separators stripped).
  const filename = (file.name || `file.${ext}`).replace(/[\\/\0]/g, "_").slice(0, 120);
  return Response.json({ url: `/uploads/${session.tenantId}/chat/${name}`, mime: file.type, filename, size: file.size });
}
