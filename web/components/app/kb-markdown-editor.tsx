"use client";

import { useRef, useState, type RefObject } from "react";
import { Heading, Bold, Italic, List, Code, Link2, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mdToHtml } from "@/lib/markdown";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
  disabled?: boolean;
  className?: string;
};

type Ref = RefObject<HTMLTextAreaElement | null>;

function focusBack(ref: Ref, pos: number, len = 0) {
  requestAnimationFrame(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(pos, pos + len);
  });
}

// Bungkus seleksi dengan marker (bold/italic/code) — atau sisipkan contoh "teks".
function wrap(ref: Ref, value: string, onChange: (v: string) => void, marker: string) {
  const ta = ref.current;
  if (!ta) return;
  const { selectionStart: start, selectionEnd: end } = ta;
  const sel = value.slice(start, end) || "teks";
  onChange(value.slice(0, start) + marker + sel + marker + value.slice(end));
  focusBack(ref, start + marker.length, sel.length);
}

// Sisipkan prefix di awal baris saat ini (heading/list).
function prefixLine(ref: Ref, value: string, onChange: (v: string) => void, prefix: string) {
  const ta = ref.current;
  if (!ta) return;
  const start = ta.selectionStart;
  const ls = value.lastIndexOf("\n", start - 1) + 1;
  onChange(value.slice(0, ls) + prefix + value.slice(ls));
  focusBack(ref, start + prefix.length);
}

function insertLink(ref: Ref, value: string, onChange: (v: string) => void) {
  const ta = ref.current;
  if (!ta) return;
  const { selectionStart: start, selectionEnd: end } = ta;
  const label = value.slice(start, end) || "teks";
  onChange(value.slice(0, start) + `[${label}](https://)` + value.slice(end));
  focusBack(ref, start + label.length + 3, 8); // taruh kursor di dalam (…) untuk URL
}

const TOOLS = [
  { icon: Heading, title: "Judul", kind: "prefix", arg: "## " },
  { icon: Bold, title: "Tebal", kind: "wrap", arg: "**" },
  { icon: Italic, title: "Miring", kind: "wrap", arg: "_" },
  { icon: List, title: "Daftar", kind: "prefix", arg: "- " },
  { icon: Code, title: "Kode", kind: "wrap", arg: "`" },
  { icon: Link2, title: "Tautan", kind: "link", arg: "" },
] as const;

// Styling preview tanpa @tailwindcss/typography — selector anak.
const PREVIEW_CLS =
  "min-h-[120px] px-3 py-2 text-sm leading-relaxed " +
  "[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold " +
  "[&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold " +
  "[&_h4]:mt-2 [&_h4]:font-semibold [&_p]:my-1.5 " +
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs " +
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-2.5 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_a]:text-brand-blue [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground";

// Editor Markdown untuk knowledge base. Menyimpan SUMBER Markdown (bukan HTML) —
// teks ini diembed ke RAG apa adanya; LLM paham Markdown. Tab Pratinjau aman (escape).
export function KbMarkdownEditor({ value, onChange, placeholder, rows = 5, id, disabled, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background transition-shadow focus-within:border-brand-blue focus-within:ring-4 focus-within:ring-brand-blue/10",
        disabled && "bg-muted/50",
        className,
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
        {TOOLS.map((t) => (
          <Button
            key={t.title}
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled || preview}
            title={t.title}
            aria-label={t.title}
            onClick={() => {
              if (t.kind === "wrap") wrap(ref, value, onChange, t.arg);
              else if (t.kind === "prefix") prefixLine(ref, value, onChange, t.arg);
              else insertLink(ref, value, onChange);
            }}
          >
            <t.icon />
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={preview ? "Tulis" : "Pratinjau"}
          aria-label={preview ? "Tulis" : "Pratinjau"}
          aria-pressed={preview}
          className={cn("ml-auto", preview && "bg-muted text-foreground")}
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? <Pencil /> : <Eye />}
        </Button>
      </div>

      {preview ? (
        <div
          className={PREVIEW_CLS}
          dangerouslySetInnerHTML={{
            __html: mdToHtml(value) || '<span class="text-muted-foreground">(kosong)</span>',
          }}
        />
      ) : (
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-3 py-2 font-mono text-sm outline-none disabled:cursor-not-allowed"
        />
      )}
    </div>
  );
}
