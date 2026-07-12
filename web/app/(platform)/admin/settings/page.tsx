import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getPublicWebSettings } from "@/lib/web-settings-server";
import { savePlatformWebSettings } from "@/lib/actions";
import { WebSettingsForm } from "@/components/app/web-settings-form";

export default async function PlatformSettingsPage() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) notFound();

  const initial = await getPublicWebSettings();

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Platform</h1>
        <p className="text-sm text-muted-foreground">
          Branding situs publik (landing, login, opt-in): logo, nama, SEO, sosial media, kontak.
        </p>
      </div>
      <WebSettingsForm initial={initial} action={savePlatformWebSettings} />
    </div>
  );
}
