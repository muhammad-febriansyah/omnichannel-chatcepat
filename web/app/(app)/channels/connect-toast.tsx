"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { gooeyToast } from "@/components/ui/goey-toaster";

// Tampilkan feedback hasil OAuth/connect lalu bersihkan query agar tak dobel saat refresh.
export function ConnectToast() {
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (params.get("connected")) {
      gooeyToast.success("Channel berhasil terhubung");
      router.replace("/channels");
    } else if (params.get("error")) {
      gooeyToast.error(decodeURIComponent(params.get("error")!));
      router.replace("/channels");
    }
  }, [params, router]);

  return null;
}
