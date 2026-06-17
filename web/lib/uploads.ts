import "server-only";
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
