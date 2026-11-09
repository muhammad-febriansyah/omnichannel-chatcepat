"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedNavSection } from "@/lib/nav";

// ⌘K menu search: type to filter the menus this user can see, Enter to open.
export function MenuSearch({ sections }: { sections: ResolvedNavSection[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  const items = useMemo(() => {
    const all = sections.flatMap((s) => s.items.map((it) => ({ ...it, section: s.title })));
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((it) => `${it.label} ${it.section} ${it.keywords ?? ""}`.toLowerCase().includes(q));
  }, [sections, query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(index: number) {
    const it = items[index];
    if (!it) return;
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(it.locked ? "/billing" : it.href);
  }

  return (
    <div className="relative w-full max-w-[380px]">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted-foreground transition focus-within:border-brand-blue focus-within:bg-card focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]">
        <Search className="size-4 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(cursor);
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          placeholder="Cari menu…"
          aria-label="Cari menu"
          role="combobox"
          aria-expanded={open}
          aria-controls="menu-search-list"
        />
        <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </div>

      {open && (
        <div
          id="menu-search-list"
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl"
        >
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Menu tidak ditemukan</div>
          ) : (
            items.map((it, i) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.href}
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm",
                    i === cursor ? "bg-muted text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-brand-blue dark:bg-blue-500/10">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{it.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{it.section}</span>
                  </span>
                  {it.locked ? (
                    <Lock className="size-3.5" />
                  ) : (
                    i === cursor && <CornerDownLeft className="size-3.5" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
