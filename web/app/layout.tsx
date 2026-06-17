import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getActiveWebSettings, metadataFrom } from "@/lib/web-settings-server";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Metadata dinamis dari web_settings tenant (favicon, title, SEO, OG).
export async function generateMetadata(): Promise<Metadata> {
  return metadataFrom(await getActiveWebSettings());
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${poppins.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: ekstensi browser (mis. ColorZilla cz-shortcut-listen) suntik atribut ke <body> */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
