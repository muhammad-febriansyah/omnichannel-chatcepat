"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Mobile: single-column — list di /inbox, thread di /inbox/[id].
// Desktop (lg+): dua kolom berdampingan.
export function InboxPanes({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const isThread = pathname !== "/inbox";

  return (
    <div className="flex h-full min-h-0">
      <div className={cn("w-full shrink-0 lg:w-80", isThread && "hidden lg:flex")}>{list}</div>
      <div className={cn("flex-1 overflow-hidden", !isThread && "hidden lg:block")}>{children}</div>
    </div>
  );
}
