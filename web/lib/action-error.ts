// Error messages that survive production builds.
//
// Next.js replaces the message of any error thrown from a Server Action with a
// generic English text in production, but keeps `error.digest`. userError() puts
// the Indonesian message into the digest; errorMessage() reads it back on the client.

const PREFIX = "CCERR:";
const MASKED = ["The specific message is omitted", "An error occurred in the Server Components render"];

export function userError(message: string): Error {
  const err = new Error(message) as Error & { digest: string };
  err.digest = PREFIX + encodeURIComponent(message);
  return err;
}

export const STALE_DEPLOY_MESSAGE = "Aplikasi baru saja diperbarui. Muat ulang halaman, lalu coba lagi.";

/**
 * True when the page was opened before a new deploy: its Server Action ids no longer
 * exist on the server (Next.js regenerates them every build). Only a reload fixes it.
 */
export function isStaleDeploy(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /Server Action .* was not found on the server|failed-to-find-server-action|Failed to find Server Action/i.test(msg);
}

/** Readable message for any caught error (undefined when it isn't an Error). */
export function errorMessage(e: unknown): string | undefined {
  if (!(e instanceof Error)) return undefined;
  if (isStaleDeploy(e)) return STALE_DEPLOY_MESSAGE;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest === "string" && digest.startsWith(PREFIX)) {
    try {
      return decodeURIComponent(digest.slice(PREFIX.length));
    } catch {
      return e.message;
    }
  }
  if (MASKED.some((m) => e.message.startsWith(m))) {
    return "Terjadi kesalahan di server. Coba lagi beberapa saat lagi.";
  }
  return e.message;
}
