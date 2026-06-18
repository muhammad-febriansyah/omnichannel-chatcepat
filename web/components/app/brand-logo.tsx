import { CCLogo } from "@/components/app/charts";
import { cn } from "@/lib/utils";

// Logo brand dari web_settings tenant (DB). Fallback CCLogo bila tak ada logoUrl.
export function BrandLogo({
  logoUrl,
  siteName,
  variant = "dark",
  size = 28,
  withWordmark = true,
  className,
}: {
  logoUrl?: string | null;
  siteName?: string | null;
  variant?: "white" | "dark";
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- aset brand dari web_settings (upload tenant)
      <img
        src={logoUrl}
        alt={siteName || "Logo"}
        style={{ height: size }}
        className={cn("w-auto max-w-[160px] object-contain", className)}
      />
    );
  }
  return <CCLogo variant={variant} size={size} withWordmark={withWordmark} />;
}
