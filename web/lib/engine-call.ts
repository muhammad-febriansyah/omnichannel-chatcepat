import "server-only";

const ENGINE = process.env.ENGINE_INTERNAL_URL ?? "http://localhost:8000/internal/v1";

/** POST JSON to the engine as this user's role; returns data or throws a readable message. */
export async function enginePost<T>(path: string, role: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  const res = await fetch(`${ENGINE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.SERVICE_TOKEN ?? "",
      "X-Actor-Role": role,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json().catch(() => null)) as { data?: T; detail?: unknown } | null;
  if (!res.ok) {
    const detail = typeof json?.detail === "string" ? json.detail : null;
    throw new Error(detail ?? "Gagal memproses di server");
  }
  return json?.data as T;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
