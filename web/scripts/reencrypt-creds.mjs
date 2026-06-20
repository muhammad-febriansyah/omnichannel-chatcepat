// One-time: enkripsi value channels.credentials yang masih plaintext (AES-256-GCM).
// Idempoten — value sudah ber-prefix "enc:v1:" dilewati. Aman dijalankan berulang.
// Format value HARUS sama dengan lib/channel-crypto.ts & gateway crypto.go:
//   "enc:v1:" + base64( nonce(12) || ciphertext || tag(16) )
//
// Run: CHANNEL_CRED_KEY=<base64 32-byte> node scripts/reencrypt-creds.mjs

import { createCipheriv, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const PREFIX = "enc:v1:";

function pgUrl() {
  if (process.env.DATABASE_URL_SYNC) return process.env.DATABASE_URL_SYNC;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^DATABASE_URL_SYNC=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL_SYNC tidak ditemukan");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function loadKey() {
  const raw = process.env.CHANNEL_CRED_KEY;
  if (!raw) throw new Error("CHANNEL_CRED_KEY wajib (base64 32-byte) untuk enkripsi");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("CHANNEL_CRED_KEY harus 32 byte (base64)");
  return k;
}

function encryptValue(plain, k) {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, nonce);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return PREFIX + Buffer.concat([nonce, ct, tag]).toString("base64");
}

// Enkripsi tiap value string yang belum ber-prefix. Return [credsBaru, jumlahDienkripsi].
function encryptCreds(creds, k) {
  const out = {};
  let n = 0;
  for (const [field, val] of Object.entries(creds ?? {})) {
    if (typeof val === "string" && val.length > 0 && !val.startsWith(PREFIX)) {
      out[field] = encryptValue(val, k);
      n++;
    } else {
      out[field] = val;
    }
  }
  return [out, n];
}

async function main() {
  const k = loadKey();
  const sql = postgres(pgUrl());
  try {
    const rows = await sql`SELECT id::text AS id, name, credentials FROM channels`;
    let touched = 0;
    let fields = 0;
    for (const r of rows) {
      const [next, n] = encryptCreds(r.credentials, k);
      if (n === 0) {
        console.log(`· ${r.name} — sudah terenkripsi / kosong, skip`);
        continue;
      }
      await sql`UPDATE channels SET credentials = ${sql.json(next)}, updated_at = now() WHERE id = ${r.id}`;
      touched++;
      fields += n;
      console.log(`✓ ${r.name} — ${n} value dienkripsi`);
    }
    console.log(`\nSelesai: ${touched} channel, ${fields} value dienkripsi.`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
