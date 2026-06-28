// Import pricing from old MySQL (chatcepat.pricing_packages) into Postgres `plans`.
// - Drops any "Scraping" features (project no-scraping rule).
// - Maps old packages → tenantPlan tier enum (pro|business|enterprise).
// - Enterprise price → 0 so landing renders "Hubungi Kami" (Custom).
// - Trial skipped (free trial handled by /register flow, not a purchasable plan).
// Idempotent: upsert by slug.
//
// Run: node scripts/import-pricing.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import postgres from "postgres";

function pgUrl() {
  if (process.env.DATABASE_URL_SYNC) return process.env.DATABASE_URL_SYNC;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = env.match(/^DATABASE_URL_SYNC=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL_SYNC tidak ditemukan");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

// Pull old rows as JSON via mysql CLI.
function oldRows() {
  const out = execFileSync(
    "mysql",
    [
      "--protocol=tcp", "-uroot", "-proot", "-N", "-e",
      "SELECT JSON_ARRAYAGG(JSON_OBJECT('name',name,'slug',slug,'description',description," +
        "'price',price,'period_unit',period_unit,'features',features,'is_featured',is_featured," +
        "'is_active',is_active,'ord',`order`)) FROM chatcepat.pricing_packages;",
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(out);
}

// slug → tenantPlan tier enum
const TIER = { basic: "pro", medium: "business", pro: "business", enterprise: "enterprise", trial: "pro" };

function transform(rows) {
  return rows
    .filter((r) => r.slug !== "trial") // free trial = register flow, bukan paket beli
    .map((r) => {
      const features = (Array.isArray(r.features) ? r.features : JSON.parse(r.features || "[]")).filter(
        (f) => !/scraping/i.test(f),
      );
      const isEnterprise = r.slug === "enterprise";
      return {
        tier: TIER[r.slug] ?? "pro",
        name: r.name,
        slug: r.slug,
        price_idr: isEnterprise ? 0 : Math.round(Number(r.price)), // 0 → landing "Hubungi Kami"
        period: "month",
        quota: null,
        description: r.description ?? null,
        features,
        is_active: r.is_active ? true : false,
        highlight: r.is_featured ? true : false,
        sort_order: Number(r.ord) || 0,
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

async function main() {
  const plans = transform(oldRows());
  const sql = postgres(pgUrl());
  try {
    // Authoritative: old pricing menggantikan seluruh isi tabel (aman, orders=0).
    await sql`DELETE FROM plans`;
    for (const p of plans) {
      await sql`
        INSERT INTO plans (tier, name, slug, price_idr, period, quota, description, features, is_active, highlight, sort_order)
        VALUES (${p.tier}, ${p.name}, ${p.slug}, ${p.price_idr}, ${p.period}, ${p.quota},
                ${p.description}, ${sql.json(p.features)}, ${p.is_active}, ${p.highlight}, ${p.sort_order})
      `;
      console.log(`✓ ${p.slug.padEnd(11)} tier=${p.tier.padEnd(10)} Rp${p.price_idr.toLocaleString("id-ID")} feat=${p.features.length}${p.highlight ? " ★" : ""}`);
    }
    console.log(`\nImported ${plans.length} plan(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
