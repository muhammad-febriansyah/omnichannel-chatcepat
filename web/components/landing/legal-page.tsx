import Link from "next/link";
import { getPublicWebSettings } from "@/lib/web-settings-server";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

export type LegalLang = "id" | "en";

/** ?lang=en shows the English version; anything else is Indonesian. */
export function legalLang(raw: string | undefined): LegalLang {
  return raw === "en" ? "en" : "id";
}

const LABELS = {
  id: {
    updated: "Terakhir diperbarui",
    toc: "Daftar isi",
    question: "Pertanyaan? Hubungi kami di",
    seeAlso: "Lihat juga",
    privacy: "Kebijakan Privasi",
    terms: "Syarat & Ketentuan",
    deletion: "Penghapusan Data",
    and: "dan",
  },
  en: {
    updated: "Last updated",
    toc: "Contents",
    question: "Questions? Contact us at",
    seeAlso: "See also",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    deletion: "Data Deletion",
    and: "and",
  },
} as const;

// Shared shell for public legal pages (privacy, terms, data deletion): landing
// navbar/footer + a readable single column with an in-page table of contents.
// Indonesian by default; ?lang=en renders the English text the page passes in.
export async function LegalPage({
  title,
  updated,
  intro,
  sections,
  children,
  lang = "id",
  path,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections?: { id: string; title: string }[];
  children: React.ReactNode;
  lang?: LegalLang;
  path: string; // this page, for the language switch
}) {
  const ws = await getPublicWebSettings();
  const t = LABELS[lang];
  const q = lang === "en" ? "?lang=en" : "";
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar logoUrl={ws.logoUrl} siteName={ws.siteName} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-brand-blue">Legal</p>
            <nav aria-label="Language" className="inline-flex gap-1 rounded-full border border-border bg-card p-1 text-xs font-semibold">
              {(["id", "en"] as const).map((l) => (
                <Link
                  key={l}
                  href={l === "en" ? `${path}?lang=en` : path}
                  hrefLang={l}
                  aria-current={lang === l ? "page" : undefined}
                  className={lang === l ? "rounded-full bg-brand-blue px-2.5 py-1 text-white" : "rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground"}
                >
                  {l === "en" ? "English" : "Indonesia"}
                </Link>
              ))}
            </nav>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.updated}: {updated}</p>
          <div className="mt-6 text-[15px] leading-relaxed text-foreground/85">{intro}</div>

          {sections && sections.length > 0 && (
            <nav aria-label={t.toc} className="mt-8 rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold">{t.toc}</p>
              <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-muted-foreground hover:text-brand-blue">
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="mt-10 space-y-10">{children}</div>

          <p className="mt-14 border-t border-border pt-6 text-sm text-muted-foreground">
            {t.question}{" "}
            <a href={`mailto:${ws.contact.email}`} className="font-medium text-brand-blue hover:underline">
              {ws.contact.email}
            </a>
            . {t.seeAlso}{" "}
            <Link href={`/privacy${q}`} className="text-brand-blue hover:underline">
              {t.privacy}
            </Link>
            ,{" "}
            <Link href={`/terms${q}`} className="text-brand-blue hover:underline">
              {t.terms}
            </Link>
            , {t.and}{" "}
            <Link href={`/data-deletion${q}`} className="text-brand-blue hover:underline">
              {t.deletion}
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer logoUrl={ws.logoUrl} siteName={ws.siteName} />
    </div>
  );
}

export function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold text-foreground">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
