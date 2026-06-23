"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Subscribe WS gateway (realtime.<tenant>), refresh data saat ada event.
// Events: message.new, conversation.updated, conversation.assigned, channel.status (08).
export function RealtimeRefresher({ tenantId, token }: { tenantId: string; token: string }) {
  const router = useRouter();

  useEffect(() => {
    // Prod: WS same-origin (ikut host yang dibuka) → hindari mismatch www/apex +
    // redirect yang memutus handshake WS. Dev (localhost): gateway beda port → env/8080.
    const loc = window.location;
    const isLocal = loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
    const sameOrigin = `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}/ws`;
    const base = isLocal ? (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws") : sameOrigin;
    const url = `${base}?tenant=${encodeURIComponent(tenantId)}&token=${encodeURIComponent(token)}`;
    let ws: WebSocket | null = null;
    let stopped = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let attempt = 0;

    // Coalesce burst event → satu refresh (hindari refresh storm).
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 400);
    };

    // Fallback polling: bila WS tak tersambung (mis. proxy belum aktif), tetap
    // refresh tiap 10 dtk supaya status/pesan tak harus di-refresh manual.
    const startPoll = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => router.refresh(), 10_000);
    };
    const stopPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
    startPoll();

    const connect = () => {
      if (stopped) return;
      try {
        ws = new WebSocket(url);
      } catch {
        return; // WS belum tersedia — polling fallback tetap jalan
      }
      ws.onopen = () => {
        attempt = 0;
        stopPoll(); // WS hidup → matikan polling, andalkan event realtime
      };
      ws.onmessage = scheduleRefresh;
      ws.onclose = () => {
        if (stopped) return;
        startPoll(); // WS putus → nyalakan lagi polling fallback
        // Reconnect dgn backoff bertingkat (maks 30 dtk) — tahan restart gateway.
        attempt += 1;
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        reconnectTimer = setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPoll();
      if (ws) {
        ws.onclose = null; // cegah reconnect saat unmount
        ws.close();
      }
    };
  }, [tenantId, token, router]);

  return null;
}
