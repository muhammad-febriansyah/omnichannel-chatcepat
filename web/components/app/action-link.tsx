import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Link yang tampil seperti Button — supaya semua CTA navigasi (Tambah, Import, dll)
// pakai token & ukuran yang sama. Default: primary, tinggi nyaman (h-9).
type Props = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

export function ActionLink({ className, variant, size = "lg", ...props }: Props) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
