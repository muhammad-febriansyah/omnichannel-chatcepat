import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Direktori upload PERSISTEN — di luar public/ supaya tahan rebuild container
// (mount volume ke UPLOAD_DIR). Disajikan lewat route /uploads/[...path].
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "var", "uploads");

// Resolusi path aman di dalam UPLOAD_DIR (cegah path traversal). null = invalid.
export function resolveUpload(relParts: string[]): string | null {
  const rel = path.normalize(relParts.join("/"));
  const base = path.resolve(UPLOAD_DIR);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

// Format gambar foto (tanpa SVG — hindari XSS payload di aset user).
export const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Simpan file gambar ke UPLOAD_DIR/<segment>/, balikkan URL /uploads/<segment>/<name>.
export async function saveImage(file: File, segment: string): Promise<string> {
  const ext = IMAGE_EXT[file.type];
  if (!ext) throw new Error("Format harus PNG, JPG, WebP, atau GIF");
  if (file.size > IMAGE_MAX_BYTES) throw new Error("Ukuran maksimal 2 MB");
  const dir = path.join(UPLOAD_DIR, segment);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${segment}/${name}`;
}

// Hapus file upload lokal dari URL /uploads/<...>. Aman: hanya di dalam UPLOAD_DIR.
// Diam kalau bukan URL lokal / file sudah hilang.
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/uploads/")) return;
  const parts = url.slice("/uploads/".length).split("/").filter(Boolean);
  const full = resolveUpload(parts);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* file sudah tidak ada — abaikan */
  }
}
