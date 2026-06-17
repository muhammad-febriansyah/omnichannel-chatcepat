"use client";

import { GooeyToaster } from "@/components/ui/goey-toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GooeyToaster position="top-right" />
    </>
  );
}
