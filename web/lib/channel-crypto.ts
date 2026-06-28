// Enkripsi at-rest kredensial channel (AES-256-GCM). Per-value, ditandai prefix
// `enc:v1:`. Value plaintext (legacy / dev tanpa key) dibiarkan → migrasi mulus:
// value lama ke-enkripsi otomatis saat channel di-save ulang.
//
// Key: env CHANNEL_CRED_KEY = 32 byte base64. WAJIB di production (fail-hard);
// dev tanpa key → passthrough plaintext. Gateway pakai key SAMA untuk decrypt.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const raw = process.env.CHANNEL_CRED_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CHANNEL_CRED_KEY wajib di-set (base64 32-byte) di production");
    }
    return null; // dev: plaintext passthrough
  }
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("CHANNEL_CRED_KEY harus 32 byte (base64)");
  return k;
}

function encryptValue(plain: string, k: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, nonce);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: nonce(12) || ciphertext || tag(16) — cocok dengan Go gcm.Seal/Open.
  return PREFIX + Buffer.concat([nonce, ct, tag]).toString("base64");
}

function decryptValue(v: string, k: Buffer): string {
  const data = Buffer.from(v.slice(PREFIX.length), "base64");
  const nonce = data.subarray(0, 12);
  const tag = data.subarray(data.length - 16);
  const ct = data.subarray(12, data.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", k, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Enkripsi tiap value string. Value yang sudah ber-prefix tak di-enkripsi ulang. */
export function encryptCreds(creds: Record<string, unknown>): Record<string, unknown> {
  const k = key();
  if (!k) return creds;
  const out: Record<string, unknown> = {};
  for (const [field, val] of Object.entries(creds ?? {})) {
    out[field] =
      typeof val === "string" && val.length > 0 && !val.startsWith(PREFIX)
        ? encryptValue(val, k)
        : val;
  }
  return out;
}

/** Dekripsi value ber-prefix. Tanpa key / value plaintext → dibiarkan apa adanya. */
export function decryptCreds(creds: Record<string, unknown>): Record<string, unknown> {
  const k = key();
  const out: Record<string, unknown> = {};
  for (const [field, val] of Object.entries(creds ?? {})) {
    out[field] =
      k && typeof val === "string" && val.startsWith(PREFIX) ? decryptValue(val, k) : val;
  }
  return out;
}
