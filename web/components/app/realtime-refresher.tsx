"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Subscribe WS gateway (realtime.<tenant>), refresh data saat ada event.
// Events: message.new, conversation.updated, conversation.assigned, channel.status (08).
export function RealtimeRefresher({ tenantId, token }: { tenantId: string; token: string }) {
  const router = useRouter();

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
    let ws: WebSocket | null = null;
    let closed = false;
    try {
      ws = new WebSocket(`${base}?tenant=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`);
      ws.onmessage = () => router.refresh();
    } catch {
      /* WS belum tersedia — abaikan, UI tetap jalan */
    }
    return () => {
      closed = true;
      ws?.close();
      void closed;
    };
  }, [tenantId, token, router]);

  return null;
}
