import { Download, FileText } from "lucide-react";
import { attachmentKind } from "@/lib/chat-attachments";

type Media = { url?: unknown; mime?: unknown; filename?: unknown } | null | undefined;

// Attachment inside a chat bubble: image, video, audio, or a document card.
export function MessageMedia({ media, outbound }: { media: Media; outbound: boolean }) {
  const url = typeof media?.url === "string" ? media.url : "";
  if (!url || !(url.startsWith("/uploads/") || url.startsWith("https://"))) return null;
  const mime = typeof media?.mime === "string" ? media.mime : "";
  const filename = typeof media?.filename === "string" && media.filename ? media.filename : url.split("/").pop() ?? "file";
  const kind = attachmentKind(mime || (/\.(png|jpe?g|webp|gif)$/i.test(url) ? "image/jpeg" : ""));

  if (kind === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="-mx-1 -mt-0.5 mb-1 block overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served from /uploads */}
        <img src={url} alt={filename} className="max-h-80 w-full min-w-48 object-cover" />
      </a>
    );
  }
  if (kind === "video") {
    return <video src={url} controls preload="metadata" className="-mx-1 -mt-0.5 mb-1 max-h-80 w-full min-w-56 rounded-md bg-black" />;
  }
  if (kind === "audio") {
    return <audio src={url} controls preload="metadata" className="mb-1 h-10 w-64 max-w-full" />;
  }
  const ext = filename.includes(".") ? filename.split(".").pop()!.toUpperCase().slice(0, 4) : "FILE";
  return (
    <a
      href={url}
      download={filename}
      className={`mb-1 flex min-w-56 items-center gap-3 rounded-md px-2.5 py-2 ${outbound ? "bg-[#c8f2c0] dark:bg-[#024d40]" : "bg-[#f5f6f6] dark:bg-[#1a252c]"}`}
    >
      <span className="relative grid size-10 shrink-0 place-items-center rounded-md bg-white text-[#e53935] dark:bg-[#2a3942]">
        <FileText className="size-5" />
        <span className="absolute -bottom-1 rounded bg-[#e53935] px-1 text-[8px] font-bold leading-tight text-white">{ext}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{filename}</span>
      <Download className="size-4 shrink-0 text-[#54656f] dark:text-[#8696a0]" />
    </a>
  );
}
