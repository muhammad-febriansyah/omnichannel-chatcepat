// Halaman pilih Page setelah OAuth. Baca user token dari cookie httpOnly → list Page Meta.
// User pilih Page → server action subscribe webhook + simpan channel.
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { requirePageAbility } from "@/lib/session";
import { FB_OAUTH_COOKIE, listPages, verifyOAuthSession, type MetaPlatform } from "@/lib/facebook";
import { ChannelIcon } from "@/components/app/channel-icon";
import { PagePicker } from "./page-picker";

export default async function SelectPagePage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  await requirePageAbility("channel.connect");
  const platform: MetaPlatform =
    (await searchParams).platform === "instagram" ? "instagram" : "facebook";
  const label = platform === "instagram" ? "Instagram" : "Facebook";

  const sealed = (await cookies()).get(FB_OAUTH_COOKIE)?.value;
  const oauth = sealed ? await verifyOAuthSession(sealed) : null;

  let error: string | null = null;
  let pages: { id: string; name: string; picture?: string }[] = [];
  if (!oauth) {
    error = "Sesi OAuth kedaluwarsa. Ulangi Login dengan Facebook.";
  } else {
    try {
      pages = (await listPages(oauth.userToken)).map((p) => ({ id: p.id, name: p.name, picture: p.picture }));
      if (pages.length === 0) error = "Tidak ada Page yang kamu kelola. Buat/admin-kan Page dulu di Facebook.";
    } catch (e) {
      error = e instanceof Error ? e.message : "Gagal memuat daftar Page.";
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <Link
        href="/channels/connect"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali
      </Link>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border bg-[#1877f2]/10 px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#1877f2] text-white shadow-sm ring-1 ring-black/5">
            <ChannelIcon type={platform} className="size-5" />
          </span>
          <div>
            <div className="text-sm font-semibold">Pilih Page {label}</div>
            <div className="text-xs text-muted-foreground">Pesan ke Page terpilih masuk ke inbox.</div>
          </div>
        </div>

        <div className="p-5">
          {error ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Link
                href={`/api/channels/facebook/oauth/start?platform=${platform}`}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1877f2] px-4 text-sm font-semibold text-white transition hover:bg-[#1568d8]"
              >
                <ChannelIcon type={platform} className="size-4" /> Ulangi Login dengan {label}
              </Link>
            </div>
          ) : (
            <PagePicker pages={pages} platform={platform} />
          )}
        </div>
      </div>
    </div>
  );
}
