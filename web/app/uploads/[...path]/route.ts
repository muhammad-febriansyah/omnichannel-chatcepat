import { readFile } from "node:fs/promises";
import { resolveUpload } from "@/lib/uploads";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  ico: "image/x-icon",
  // Chat attachments (lib/chat-attachments.ts)
  mp4: "video/mp4",
  "3gp": "video/3gpp",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
};

// Media that a browser may show inline; everything else downloads.
const INLINE = new Set(["png", "jpg", "jpeg", "webp", "gif", "ico", "mp4", "3gp", "mp3", "ogg", "m4a", "aac", "pdf"]);

// GET /uploads/<tenant>/<name> — sajikan aset upload dari UPLOAD_DIR (persisten).
// Publik (logo/favicon tampil di login/opt-in) — lihat middleware.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const full = resolveUpload(parts);
  if (!full) return new Response("not found", { status: 404 });

  try {
    const buf = await readFile(full);
    const ext = (parts.at(-1)?.split(".").pop() ?? "").toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": INLINE.has(ext) ? "inline" : "attachment",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
