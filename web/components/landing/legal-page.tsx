import Link from "next/link";
import { getPublicWebSettings } from "@/lib/web-settings-server";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

// Shared shell for public legal pages (privacy, terms, data deletion): landing
// navbar/footer + a readable single column with an in-page table of contents.
export async function LegalPage({
  title,
  updated,
  intro,
  sections,
  children,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections?: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  const ws = await getPublicWebSettings();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar logoUrl={ws.logoUrl} siteName={ws.siteName} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">
          <p className="text-sm font-medium text-brand-blue">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Terakhir diperbarui: {updated}</p>
          <div className="mt-6 text-[15px] leading-relaxed text-foreground/85">{intro}</div>

          {sections && sections.length > 0 && (
            <nav aria-label="Daftar isi" className="mt-8 rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-semibold">Daftar isi</p>
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
            Pertanyaan? Hubungi kami di{" "}
            <a href={`mailto:${ws.contact.email}`} className="font-medium text-brand-blue hover:underline">
              {ws.contact.email}
            </a>
            . Lihat juga{" "}
            <Link href="/privacy" className="text-brand-blue hover:underline">
              Kebijakan Privasi
            </Link>
            ,{" "}
            <Link href="/terms" className="text-brand-blue hover:underline">
              Syarat &amp; Ketentuan
            </Link>
            , dan{" "}
            <Link href="/data-deletion" className="text-brand-blue hover:underline">
              Penghapusan Data
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
