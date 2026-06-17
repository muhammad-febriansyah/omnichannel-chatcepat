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
};

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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
