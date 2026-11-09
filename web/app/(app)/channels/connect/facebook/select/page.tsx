import { errorMessage } from "@/lib/action-error";
// Halaman pilih akun setelah OAuth. Baca user token dari cookie httpOnly → list Page Meta
// (+ akun Instagram tertaut). User pilih → server action subscribe webhook + simpan channel.
import Link from "next/link";
import { cookies } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { ArrowLeft, AlertCircle, Check } from "lucide-react";
import { requirePageAbility } from "@/lib/session";
import { db } from "@/lib/db";
import { channels } from "@/lib/db/schema";
import { FB_OAUTH_COOKIE, getInstagramProfile, listPages, verifyOAuthSession, type MetaPlatform } from "@/lib/facebook";
import { ChannelIcon } from "@/components/app/channel-icon";
import { cn } from "@/lib/utils";
import { PagePicker, type PickerPage } from "./page-picker";

const HEADER: Record<MetaPlatform, { title: string; text: string; tint: string; icon: string }> = {
  instagram: {
    title: "Pilih akun Instagram",
    text: "DM dan komentar dari akun yang dipilih akan masuk ke inbox.",
    tint: "from-[#feda75]/25 via-[#d62976]/15 to-[#4f5bd5]/20",
    icon: "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5]",
  },
  facebook: {
    title: "Pilih Facebook Page",
    text: "Pesan Messenger dan komentar postingan Page yang dipilih akan masuk ke inbox.",
    tint: "from-[#1877f2]/15 to-[#1877f2]/5",
    icon: "bg-[#1877f2]",
  },
};

function Steps() {
  const steps = ["Login Facebook", "Pilih akun", "Terhubung"];
  return (
    <ol className="flex items-center gap-2 text-xs font-medium">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-5 bg-border sm:w-8" />}
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full text-[10px] font-bold",
              i === 0 ? "bg-emerald-500 text-white" : i === 1 ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {i === 0 ? <Check className="size-3" /> : i + 1}
          </span>
          <span className={i === 1 ? "text-foreground" : "text-muted-foreground"}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function SelectPagePage({ searchParams }: { searchParams: Promise<{ platform?: string }> }) {
  const session = await requirePageAbility("channel.connect");
  const platform: MetaPlatform = (await searchParams).platform === "instagram" ? "instagram" : "facebook";
  const label = platform === "instagram" ? "Instagram" : "Facebook";
  const head = HEADER[platform];

  const sealed = (await cookies()).get(FB_OAUTH_COOKIE)?.value;
  const oauth = sealed ? await verifyOAuthSession(sealed) : null;

  let error: string | null = null;
  let pages: PickerPage[] = [];
  if (!oauth || oauth.tenantId !== session.tenantId) {
    error = "Sesi login Facebook sudah habis. Ulangi Login dengan Facebook.";
  } else {
    try {
      const raw = await listPages(oauth.userToken);
      // Instagram: the account linked to each Page (what actually gets connected).
      const igs =
        platform === "instagram"
          ? await Promise.all(raw.map((p) => getInstagramProfile(p.id, p.access_token).catch(() => null)))
          : raw.map(() => null);
      const externalIds = raw.map((p, i) => (platform === "instagram" ? igs[i]?.id : p.id)).filter((x): x is string => !!x);
      // Already-linked accounts: ours → "connected", another workspace → blocked (one account, one workspace).
      const linked = externalIds.length
        ? await db
            .select({ externalId: channels.externalId, tenantId: channels.tenantId })
            .from(channels)
            .where(and(eq(channels.type, platform), inArray(channels.externalId, externalIds)))
        : [];
      pages = raw.map((p, i) => {
        const ig = igs[i];
        const ext = platform === "instagram" ? ig?.id : p.id;
        const hit = ext ? linked.find((l) => l.externalId === ext) : undefined;
        const status: PickerPage["status"] =
          platform === "instagram" && !ig ? "no_ig" : hit ? (hit.tenantId === session.tenantId ? "here" : "elsewhere") : "available";
        return {
          id: p.id,
          name: p.name,
          picture: p.picture,
          ig: ig ? { username: ig.username, name: ig.name, picture: ig.picture } : null,
          status,
        };
      });
      if (pages.length === 0) error = "Tidak ada Facebook Page yang diberi akses. Ulangi login dan centang Page Anda.";
    } catch (e) {
      error = errorMessage(e) ?? "Gagal memuat daftar akun dari Facebook.";
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
      <Link href="/channels/connect" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-4" /> Kembali
      </Link>

      <div className="overflow-hidden rounded-[20px] border border-border bg-card shadow-sm">
        <div className={cn("space-y-4 border-b border-border bg-gradient-to-br px-5 py-5 sm:px-6", head.tint)}>
          <Steps />
          <div className="flex items-center gap-3">
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm", head.icon)}>
              <ChannelIcon type={platform} className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-semibold">{head.title}</h1>
              <p className="text-sm text-muted-foreground">{head.text}</p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {error ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
              {/* Plain <a>: an API route that redirects to Facebook must not be prefetched. */}
              <a
                href={`/api/channels/facebook/oauth/start?platform=${platform}`}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1877f2] px-4 text-sm font-semibold text-white transition hover:bg-[#1568d8]"
              >
                <ChannelIcon type="facebook" className="size-4" /> Ulangi Login dengan Facebook
              </a>
            </div>
          ) : (
            <PagePicker pages={pages} platform={platform} />
          )}
        </div>
      </div>

      <p className="mt-4 px-1 text-xs leading-relaxed text-muted-foreground">
        Akun {label} tidak muncul? Pastikan akun Instagram sudah <b>Professional</b> dan ditautkan ke Facebook Page, lalu{" "}
        <a href={`/api/channels/facebook/oauth/start?platform=${platform}`} className="font-medium text-brand-blue hover:underline">
          ulangi login
        </a>{" "}
        dan centang Page tersebut.
      </p>
    </div>
  );
}
