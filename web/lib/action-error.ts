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

/** Readable message for any caught error (undefined when it isn't an Error). */
export function errorMessage(e: unknown): string | undefined {
  if (!(e instanceof Error)) return undefined;
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
