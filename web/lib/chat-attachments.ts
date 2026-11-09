// Chat attachments (Inbox → kirim file seperti WhatsApp). Client-safe: shared by the
// upload route, the composer and the message bubbles.

export type AttachmentKind = "image" | "video" | "audio" | "document";

// MIME → [extension, kind]. No HTML/SVG/scripts: files are served publicly so
// Meta/Telegram/WhatsApp can fetch them.
export const CHAT_MIME: Record<string, [string, AttachmentKind]> = {
  "image/jpeg": ["jpg", "image"],
  "image/png": ["png", "image"],
  "image/webp": ["webp", "image"],
  "image/gif": ["gif", "image"],
  "video/mp4": ["mp4", "video"],
  "video/3gpp": ["3gp", "video"],
  "audio/mpeg": ["mp3", "audio"],
  "audio/ogg": ["ogg", "audio"],
  "audio/mp4": ["m4a", "audio"],
  "audio/aac": ["aac", "audio"],
  "application/pdf": ["pdf", "document"],
  "application/msword": ["doc", "document"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx", "document"],
  "application/vnd.ms-excel": ["xls", "document"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx", "document"],
  "application/vnd.ms-powerpoint": ["ppt", "document"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx", "document"],
  "text/plain": ["txt", "document"],
  "text/csv": ["csv", "document"],
  "application/zip": ["zip", "document"],
};

// WhatsApp Cloud limits: image 5 MB, others 16 MB (documents up to 100 MB, capped lower here).
export const CHAT_MAX_BYTES: Record<AttachmentKind, number> = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
};

export const CHAT_ACCEPT = Object.keys(CHAT_MIME).join(",");

export type ChatAttachment = { url: string; mime: string; filename: string; size: number };

export function attachmentKind(mime: string | null | undefined): AttachmentKind {
  if (!mime) return "document";
  return CHAT_MIME[mime]?.[1] ?? (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "document");
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
