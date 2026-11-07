"use client";

import { Fragment } from "react";
import { CornerUpLeft, ExternalLink, Phone, ImageIcon, Video, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewButton = { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string };

// Minimal WhatsApp markup → React (*bold*, _italic_, ~strike~). Plain text otherwise.
function waMarkup(text: string) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return parts.map((p, i) => {
    if (/^\*[^*]+\*$/.test(p)) return <b key={i}>{p.slice(1, -1)}</b>;
    if (/^_[^_]+_$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>;
    if (/^~[^~]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

const BTN_ICON = { QUICK_REPLY: CornerUpLeft, URL: ExternalLink, PHONE_NUMBER: Phone } as const;

// Phone-style preview of a WhatsApp template / interactive message bubble.
export function WaTemplatePreview({
  headerFormat = "NONE",
  headerText,
  mediaUrl,
  body,
  footer,
  buttons = [],
  className,
}: {
  headerFormat?: string;
  headerText?: string;
  mediaUrl?: string | null;
  body: string;
  footer?: string;
  buttons?: PreviewButton[];
  className?: string;
}) {
  const fmt = headerFormat.toUpperCase();
  // WhatsApp shows 3 buttons, the rest collapse behind "Lihat semua opsi".
  const shown = buttons.length > 3 ? buttons.slice(0, 2) : buttons;
  return (
    <div className={cn("rounded-2xl bg-[#efeae2] p-3 dark:bg-[#0b141a]", className)}>
      <div className="max-w-[300px] overflow-hidden rounded-lg rounded-tl-none bg-white text-[13.5px] text-[#111b21] shadow-sm dark:bg-[#202c33] dark:text-[#e9edef]">
        {fmt === "IMAGE" &&
          (mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="Header" className="aspect-square w-full object-cover p-1 pb-0" />
          ) : (
            <div className="m-1 mb-0 grid aspect-[4/3] place-items-center rounded-md bg-[#d9dee2] text-[#8696a0] dark:bg-[#2a3942]">
              <ImageIcon className="size-8" />
            </div>
          ))}
        {fmt === "VIDEO" && (
          <div className="m-1 mb-0 grid aspect-video place-items-center rounded-md bg-[#d9dee2] text-[#8696a0] dark:bg-[#2a3942]">
            <Video className="size-8" />
          </div>
        )}
        {fmt === "DOCUMENT" && (
          <div className="m-1 mb-0 flex items-center gap-2 rounded-md bg-[#f0f2f5] px-3 py-3 text-xs dark:bg-[#2a3942]">
            <FileText className="size-5 text-red-500" /> Dokumen.pdf
          </div>
        )}
        <div className="px-2.5 pb-1.5 pt-2">
          {fmt === "TEXT" && headerText && <div className="mb-1 font-bold">{headerText}</div>}
          <div className="whitespace-pre-wrap break-words leading-snug">
            {body ? waMarkup(body) : <span className="text-[#8696a0]">Isi pesan…</span>}
          </div>
          {footer && <div className="mt-1 text-[12px] text-[#667781] dark:text-[#8696a0]">{footer}</div>}
          <div className="mt-0.5 text-right text-[10.5px] text-[#667781] dark:text-[#8696a0]">12:00</div>
        </div>
        {shown.map((b, i) => {
          const Icon = BTN_ICON[b.type] ?? CornerUpLeft;
          return (
            <div
              key={i}
              className="flex items-center justify-center gap-1.5 border-t border-[#e9edef] px-2 py-2 text-[13.5px] font-medium text-[#00a884] dark:border-[#2a3942] dark:text-[#53bdeb]"
            >
              <Icon className="size-3.5" /> {b.text || "Tombol"}
            </div>
          );
        })}
        {buttons.length > 3 && (
          <div className="flex items-center justify-center gap-1.5 border-t border-[#e9edef] px-2 py-2 text-[13.5px] font-medium text-[#00a884] dark:border-[#2a3942] dark:text-[#53bdeb]">
            Lihat semua opsi
          </div>
        )}
      </div>
    </div>
  );
}
