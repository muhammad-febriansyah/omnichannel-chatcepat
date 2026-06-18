import { listActivePlans } from "@/lib/billing-actions";
import { getActiveWebSettings } from "@/lib/web-settings-server";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { FloatingActions } from "@/components/landing/floating-actions";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { TrustStrip } from "@/components/landing/trust-strip";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { ProductPreview } from "@/components/landing/product-preview";
import { UseCases } from "@/components/landing/use-cases";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Comparison } from "@/components/landing/comparison";
import { Pricing } from "@/components/landing/pricing";
import { Testimonials } from "@/components/landing/testimonials";
import { Faq } from "@/components/landing/faq";
import { CtaBand } from "@/components/landing/cta-band";
import { Footer } from "@/components/landing/footer";

export default async function Home() {
  let plans: Awaited<ReturnType<typeof listActivePlans>> = [];
  try {
    plans = await listActivePlans();
  } catch {
    // Landing tetap tampil walau DB/pricing tidak tersedia.
    plans = [];
  }
  const ws = await getActiveWebSettings();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollProgress />
      <Navbar logoUrl={ws.logoUrl} siteName={ws.siteName} />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Stats />
        <Features />
        <ProductPreview />
        <UseCases />
        <HowItWorks />
        <Comparison />
        <Pricing plans={plans} />
        <Testimonials />
        <Faq />
        <CtaBand />
      </main>
      <Footer logoUrl={ws.logoUrl} siteName={ws.siteName} />
      <FloatingActions whatsapp={ws.social?.whatsapp} />
    </div>
  );
}
