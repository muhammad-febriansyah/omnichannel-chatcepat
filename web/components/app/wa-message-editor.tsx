"use client";

import { useRef, useState, type RefObject } from "react";
import { Bold, Italic, Strikethrough, Code, Smile, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { waToHtml } from "@/lib/wa-format";

// Emoji per kategori (seperti picker WhatsApp) — tanpa dependency picker berat.
const EMOJI_GROUPS: { label: string; icon: string; items: string[] }[] = [
  {
    label: "Senyum",
    icon: "😊",
    items: ["😊", "😄", "😁", "😂", "🤣", "😅", "😉", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😇", "🙂", "🤗", "🤔", "😌", "😴", "😢", "😭", "😤", "😡", "😱", "🥺", "😳", "🙄", "😬"],
  },
  {
    label: "Gestur",
    icon: "👍",
    items: ["👍", "👎", "👌", "✌️", "🤞", "🙏", "🙌", "👏", "🤝", "💪", "👋", "🤙", "👉", "👆", "☝️", "✋", "🫶", "🤲"],
  },
  {
    label: "Hati",
    icon: "❤️",
    items: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💖", "💯", "✨", "🔥", "⭐", "🌟", "🎉", "🎁", "🎊"],
  },
  {
    label: "Belanja",
    icon: "🛍️",
    items: ["🛍️", "🛒", "📦", "🚚", "💳", "💰", "💵", "🏷️", "🧾", "📞", "📱", "💬", "📩", "📍", "⏰", "📅", "✅", "❌", "⚠️", "ℹ️", "➡️", "🆕", "🆓", "🔔"],
  },
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
          <EmojiPicker
            onPick={(e) => insertAtCursor(textareaRef, value, onChange, e)}
            onClose={() => setEmojiOpen(false)}
          />
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

// Fixed-size popover above the toolbar: category tabs + scrollable grid.
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [group, setGroup] = useState(0);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Pilih emoji"
        className="absolute bottom-full left-0 z-50 mb-2 w-[300px] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
      >
        <div className="flex border-b border-border">
          {EMOJI_GROUPS.map((g, i) => (
            <button
              key={g.label}
              type="button"
              title={g.label}
              onClick={() => setGroup(i)}
              className={cn(
                "flex flex-1 items-center justify-center py-2 text-lg transition-colors",
                i === group ? "border-b-2 border-primary bg-muted/60" : "opacity-60 hover:opacity-100",
              )}
            >
              {g.icon}
            </button>
          ))}
        </div>
        <p className="px-3 pt-2 text-[11px] font-medium text-muted-foreground">{EMOJI_GROUPS[group].label}</p>
        <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto p-2">
          {EMOJI_GROUPS[group].items.map((e) => (
            <button
              key={e}
              type="button"
              className="flex aspect-square items-center justify-center rounded-md text-xl leading-none hover:bg-muted"
              onClick={() => onPick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
