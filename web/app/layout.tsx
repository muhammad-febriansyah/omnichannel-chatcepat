import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { getPublicWebSettings, metadataFrom } from "@/lib/web-settings-server";

// Metadata dinamis dari web_settings tenant (favicon, title, SEO, OG).
export async function generateMetadata(): Promise<Metadata> {
  return metadataFrom(await getPublicWebSettings());
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      {/* suppressHydrationWarning: ekstensi browser (mis. ColorZilla cz-shortcut-listen) suntik atribut ke <body> */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
