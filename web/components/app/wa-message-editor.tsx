"use client";

import { useRef, useState, type RefObject } from "react";
import { Bold, Italic, Strikethrough, Code, Smile, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { waToHtml } from "@/lib/wa-format";

// Emoji umum CS/penjualan — cukup, tanpa dependency picker berat.
const EMOJIS = [
  "😊", "🙏", "👍", "🙌", "🔥", "✅", "🎉", "❤️",
  "😅", "😍", "🛍️", "📦", "💯", "⭐", "😄", "🤝",
];

export type WaVariable = { label: string; token: string };

type ToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  variables?: WaVariable[];
  disabled?: boolean;
  onTogglePreview?: () => void;
  previewActive?: boolean;
  className?: string;
};

// Bungkus seleksi (atau sisipkan) di textarea dengan marker WA, lalu pulihkan kursor.
function wrapSelection(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (v: string) => void,
  marker: string,
) {
  const ta = ref.current;
  if (!ta) return;
  const start = ta.selectionStart ?? value.length;
  const end = ta.selectionEnd ?? value.length;
  const sel = value.slice(start, end) || "teks";
  onChange(value.slice(0, start) + marker + sel + marker + value.slice(end));
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + marker.length, start + marker.length + sel.length);
  });
}

function insertAtCursor(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (v: string) => void,
  text: string,
) {
  const ta = ref.current;
  const start = ta?.selectionStart ?? value.length;
  const end = ta?.selectionEnd ?? value.length;
  onChange(value.slice(0, start) + text + value.slice(end));
  requestAnimationFrame(() => {
    ta?.focus();
    const pos = start + text.length;
    ta?.setSelectionRange(pos, pos);
  });
}

const FORMATS = [
  { icon: Bold, marker: "*", title: "Tebal" },
  { icon: Italic, marker: "_", title: "Miring" },
  { icon: Strikethrough, marker: "~", title: "Coret" },
  { icon: Code, marker: "```", title: "Monospace" },
] as const;

// Toolbar format WhatsApp yang beroperasi pada textarea via ref. Dipakai mandiri
// (mis. di composer balasan) atau lewat WaMessageEditor.
export function WaFormatToolbar({
  textareaRef,
  value,
  onChange,
  variables,
  disabled,
  onTogglePreview,
  previewActive,
  className,
}: ToolbarProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);

  return (
    <div className={cn("flex flex-wrap items-center gap-0.5", className)}>
      {FORMATS.map((f) => (
        <Button
          key={f.marker}
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          title={f.title}
          aria-label={f.title}
          onClick={() => wrapSelection(textareaRef, value, onChange, f.marker)}
        >
          <f.icon />
        </Button>
      ))}

      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          title="Emoji"
          aria-label="Emoji"
          aria-expanded={emojiOpen}
          onClick={() => setEmojiOpen((o) => !o)}
        >
          <Smile />
        </Button>
        {emojiOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} />
            <div className="absolute bottom-full left-0 z-20 mb-1 grid grid-cols-8 gap-0.5 rounded-lg border border-border bg-card p-1.5 shadow-md">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex size-7 items-center justify-center rounded-md text-base hover:bg-muted"
                  onClick={() => {
                    insertAtCursor(textareaRef, value, onChange, e);
                    setEmojiOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {variables && variables.length > 0 && (
        <div className="ml-1 flex flex-wrap items-center gap-1">
          {variables.map((v) => (
            <button
              key={v.token}
              type="button"
              disabled={disabled}
              title={`Sisipkan ${v.label}`}
              className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
              onClick={() => insertAtCursor(textareaRef, value, onChange, v.token)}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {onTogglePreview && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Pratinjau"
          aria-label="Pratinjau"
          aria-pressed={previewActive}
          className={cn("ml-auto", previewActive && "bg-muted text-foreground")}
          onClick={onTogglePreview}
        >
          <Eye />
        </Button>
      )}
    </div>
  );
}

type EditorProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  variables?: WaVariable[];
  disabled?: boolean;
  id?: string;
  maxLength?: number;
  className?: string;
};

// Field pesan WhatsApp: toolbar format + textarea + pratinjau markup. Menyimpan
// plaintext ber-markup WA (*tebal* dst), bukan HTML — aman dikirim ke WhatsApp.
export function WaMessageEditor({
  value,
  onChange,
  placeholder,
  rows = 5,
  variables,
  disabled,
  id,
  maxLength,
  className,
}: EditorProps) {
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
      <div className="flex items-center gap-1 border-b border-border px-1.5 py-1">
        <WaFormatToolbar
          textareaRef={ref}
          value={value}
          onChange={onChange}
          variables={variables}
          disabled={disabled || preview}
          onTogglePreview={() => setPreview((p) => !p)}
          previewActive={preview}
        />
        {typeof maxLength === "number" && (
          <span className="shrink-0 px-1 text-[11px] tabular-nums text-muted-foreground">
            {value.length}/{maxLength}
          </span>
        )}
      </div>

      {preview ? (
        <div
          className="min-h-[88px] whitespace-pre-wrap break-words px-3 py-2 text-sm leading-relaxed"
          style={{ minHeight: `${rows * 1.5}rem` }}
          dangerouslySetInnerHTML={{
            __html: waToHtml(value) || '<span class="text-muted-foreground">(kosong)</span>',
          }}
        />
      ) : (
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed"
        />
      )}
    </div>
  );
}
