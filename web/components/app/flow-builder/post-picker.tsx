"use client";

import { useState, useTransition } from "react";
import {
  Check,
  ExternalLink,
  ImageOff,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { listChannelPosts, type SocialPost } from "@/lib/social-posts";
import type { ChannelOption } from "./config-panel";

// Pick the Facebook/Instagram posts a comment flow answers. Each post can get its own
// flow (its own replies); no post picked = every post of the chosen accounts.
export function PostPicker({
  value,
  onChange,
  accounts,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  accounts: ChannelOption[];
}) {
  const [chosen, setAccountId] = useState(accounts[0]?.id ?? "");
  const [posts, setPosts] = useState<Record<string, SocialPost[]>>({});
  const [pending, start] = useTransition();
  // Fall back to the first account when the trigger's account list changes.
  const accountId = accounts.some((a) => a.id === chosen)
    ? chosen
    : (accounts[0]?.id ?? "");

  const load = (id: string) =>
    start(async () => {
      try {
        const list = await listChannelPosts(id);
        setPosts((p) => ({ ...p, [id]: list }));
      } catch (e) {
        gooeyToast.error(
          e instanceof Error ? e.message : "Gagal mengambil postingan",
        );
      }
    });

  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
        Hubungkan Facebook Page atau Instagram dulu di menu Channel.
      </p>
    );
  }

  const list = posts[accountId];
  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );

  return (
    <div className="space-y-2">
      {accounts.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccountId(a.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                a.id === accountId
                  ? "border-brand-blue bg-blue-50 text-brand-blue dark:bg-blue-500/10"
                  : "border-transparent bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {a.name} · {a.type === "instagram" ? "IG" : "FB"}
            </button>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || !accountId}
        onClick={() => load(accountId)}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {list ? "Muat ulang postingan" : "Pilih dari postingan"}
      </Button>

      {list && list.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Belum ada postingan di akun ini.
        </p>
      )}
      {list && list.length > 0 && (
        <div className="grid max-h-80 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
          {list.map((p) => {
            const picked =
              value.includes(p.id) || value.some((v) => p.id.endsWith("_" + v));
            return (
              <div key={p.id} className="group relative aspect-square">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  title={p.caption || p.id}
                  aria-pressed={picked}
                  className={cn(
                    "relative size-full overflow-hidden rounded-lg border-2 bg-muted text-left",
                    picked
                      ? "border-brand-blue"
                      : "border-transparent hover:border-border",
                  )}
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote Meta CDN thumbnail
                    <img
                      src={p.image}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex size-full flex-col justify-between p-1.5">
                      <ImageOff className="size-3.5 text-muted-foreground" />
                      <span className="line-clamp-3 text-[10px] leading-tight text-muted-foreground">
                        {p.caption || "Postingan teks"}
                      </span>
                    </span>
                  )}
                  {picked && (
                    <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-brand-blue text-white">
                      <Check className="size-3" />
                    </span>
                  )}
                </button>
                {p.link && (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Buka postingan"
                    className="absolute bottom-1.5 right-1.5 hidden size-5 place-items-center rounded-full bg-black/60 text-white focus-visible:grid group-hover:grid"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        {value.length
          ? `${value.length} postingan dipilih — flow ini hanya membalas komentar di postingan itu.`
          : "Belum ada yang dipilih = semua postingan."}
      </p>
    </div>
  );
}
