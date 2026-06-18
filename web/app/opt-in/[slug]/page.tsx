import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { getWebSettingsBySlug, metadataFrom } from "@/lib/web-settings-server";
import { BrandLogo } from "@/components/app/brand-logo";
import { OptInForm } from "@/components/app/opt-in-form";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ws = await getWebSettingsBySlug(slug);
  return {
    ...metadataFrom(ws),
    title: `Berlangganan ${ws.siteName}`,
  };
}

export default async function OptInPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let tenant: { name: string } | undefined;
  try {
    const t = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
    if (t && t.status === "active") tenant = { name: t.name };
  } catch {
    /* notFound di bawah */
  }
  if (!tenant) notFound();

  const ws = await getWebSettingsBySlug(slug);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-navy via-brand-blue to-brand-light p-6">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo logoUrl={ws.logoUrl} siteName={ws.siteName} variant="dark" size={36} />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-brand-navy">Berlangganan {tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dapatkan update & promo langsung di WhatsApp kamu.</p>
        </div>
        <OptInForm slug={slug} workspaceName={tenant.name} />
        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          Dengan berlangganan kamu setuju dihubungi via WhatsApp. Bisa berhenti kapan saja.
        </p>
      </div>
    </div>
  );
}
