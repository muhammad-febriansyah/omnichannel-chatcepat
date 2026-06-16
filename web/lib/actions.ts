"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";

const ENGINE = process.env.ENGINE_INTERNAL_URL ?? "http://localhost:8000/internal/v1";

export async function sendReply(conversationId: string, body: string) {
  const session = await getSession();
  const res = await fetch(`${ENGINE}/conversations/${conversationId}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": session.role,
    },
    body: JSON.stringify({ body }),
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Gagal mengirim pesan${msg ? `: ${msg}` : ""}`);
  }
  revalidatePath(`/inbox/${conversationId}`);
}
