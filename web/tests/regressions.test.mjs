import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgTable, text, integer, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Execute actual TypeScript modules with narrow service boundaries injected.
function loadTS(file, mocks = {}) {
  const filename = path.resolve(root, file);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (name) => {
    if (name in mocks) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith("./") || name.startsWith("../") || name.startsWith("@/")) {
      const child = name.startsWith("@/") ? path.join(root, name.slice(2)) : path.resolve(path.dirname(filename), name);
      return loadTS(path.relative(root, child + ".ts"), mocks);
    }
    return require(name);
  };
  new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test("contact normalization retains explicit international country codes", () => {
  const { normalizePhone } = loadTS("lib/phone.ts");
  assert.equal(normalizePhone("0812-3456-789"), "628123456789");
  assert.equal(normalizePhone("+81 9012345678"), "819012345678");
  assert.equal(normalizePhone("0081 9012345678"), "819012345678");
});

test("deprecated api.co never fetches accounts or templates", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("provider must remain unused"); };
  try {
    const api = loadTS("lib/apico-server.ts");
    assert.deepEqual(await api.listApiCoTemplates(), []);
    assert.deepEqual((await api.listApiCoAccounts("instagram")).accounts, []);
    assert.ok((await api.createApiCoTemplate({})).error);
    assert.ok((await api.submitApiCoTemplate("old" )).error);
  } finally { globalThis.fetch = original; }
});

test("session honors current user role, disabled users, and suspended tenants", async () => {
  let user = { id: "user", tenantId: "tenant", role: "client", status: "active", name: "Current", email: "current@example.test" };
  let tenant = { id: "tenant", status: "active", name: "Tenant", plan: "basic" };
  const mocks = {
    react: { cache: (fn) => fn },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "old-cookie" }) }) },
    "next/navigation": { redirect: () => { throw new Error("redirect"); } },
    "./auth": { verifySession: async () => ({ sub: "user", role: "admin", tenantId: null, name: "Stale" }) },
    "./db": { db: { query: { users: { findFirst: async () => user }, tenants: { findFirst: async () => tenant } } } },
    "./db/schema": { users: { id: "id" }, tenants: { id: "id", createdAt: "createdAt" } },
  };
  const { getSession } = loadTS("lib/session.ts", mocks);
  const active = await getSession();
  assert.equal(active.role, "client");
  assert.equal(active.isPlatformAdmin, false);
  assert.equal(active.name, "Current");
  user = { ...user, status: "disabled" };
  assert.equal(await getSession(), null);
  user = { ...user, status: "active" };
  tenant = { ...tenant, status: "suspended" };
  assert.equal(await getSession(), null);
  user = null;
  assert.equal(await getSession(), null);
});

test("subscription duration preserves annual purchase and existing expiry", () => {
  const { subscriptionExpiry } = loadTS("lib/subscription.ts");
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(subscriptionExpiry(null, "year", now), "2027-01-01T00:00:00.000Z");
  assert.equal(subscriptionExpiry("2026-02-01T00:00:00Z", "month", now), "2026-03-03T00:00:00.000Z");
});

test("payment signature fails closed without configured key", () => {
  const prevCode = process.env.DUITKU_MERCHANT_CODE;
  const prevKey = process.env.DUITKU_API_KEY;
  process.env.DUITKU_MERCHANT_CODE = "TEST";
  process.env.DUITKU_API_KEY = "";
  try {
    const { verifyCallbackSignature } = loadTS("lib/duitku.ts");
    const signature = createHash("md5").update("TEST100ORDER").digest("hex");
    assert.equal(verifyCallbackSignature({ merchantCode: "TEST", amount: "100", merchantOrderId: "ORDER", signature }), false);
  } finally {
    if (prevCode === undefined) delete process.env.DUITKU_MERCHANT_CODE; else process.env.DUITKU_MERCHANT_CODE = prevCode;
    if (prevKey === undefined) delete process.env.DUITKU_API_KEY; else process.env.DUITKU_API_KEY = prevKey;
  }
});

test("parallel callbacks activate annual plan once and preserve both renewals", { skip: !process.env.SOCIAL_TEST_DATABASE_URL }, async () => {
  const schema = "payment_test_" + randomUUID().replaceAll("-", "");
  const admin = postgres(process.env.SOCIAL_TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE SCHEMA ${schema}`);
  const client = postgres(process.env.SOCIAL_TEST_DATABASE_URL, { connection: { search_path: schema }, max: 6 });
  const tenants = pgTable("tenants", { id: uuid().primaryKey(), plan: text(), planExpiresAt: timestamp("plan_expires_at", { withTimezone: true, mode: "string" }), updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }) });
  const orders = pgTable("orders", {
    id: uuid().primaryKey(), tenantId: uuid("tenant_id"), status: text(), amountIdr: integer("amount_idr"), merchantOrderId: text("merchant_order_id"),
    duitkuReference: text("duitku_reference"), tier: text(), period: text(), paymentMethod: text("payment_method"), paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }), raw: jsonb(), updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  });
  try {
    await client.unsafe("CREATE TABLE tenants (id uuid PRIMARY KEY, plan text, plan_expires_at timestamptz, updated_at timestamptz)");
    await client.unsafe("CREATE TABLE orders (id uuid PRIMARY KEY, tenant_id uuid REFERENCES tenants(id), status text, amount_idr integer, merchant_order_id text UNIQUE, duitku_reference text, tier text, period text, payment_method text, paid_at timestamptz, raw jsonb, updated_at timestamptz)");
    const tenantID = randomUUID();
    const startingExpiry = "2030-01-01T00:00:00.000Z";
    await client`INSERT INTO tenants VALUES (${tenantID}, 'basic', ${startingExpiry}, now())`;
    for (const id of ["annual", "renewal"]) {
      await client`INSERT INTO orders (id, tenant_id, status, amount_idr, merchant_order_id, tier, period) VALUES (${randomUUID()}, ${tenantID}, 'pending', 100, ${id}, 'pro', ${id === "annual" ? "year" : "month"})`;
    }
    const { POST } = loadTS("app/api/duitku/callback/route.ts", {
      "next/server": { NextResponse: Response }, "@/lib/db": { db: drizzle(client) },
      "@/lib/db/schema": { orders, tenants }, "@/lib/duitku": { verifyCallbackSignature: () => true },
    });
    const request = (id) => new Request("http://localhost/callback", { method: "POST", body: new URLSearchParams({ merchantOrderId: id, amount: "100", resultCode: "00" }) });
    const responses = await Promise.all([POST(request("annual")), POST(request("annual")), POST(request("renewal"))]);
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
    const [tenant] = await client`SELECT plan_expires_at FROM tenants WHERE id=${tenantID}`;
    assert.equal(new Date(tenant.plan_expires_at).getTime(), Date.parse(startingExpiry) + 395 * 86400000);
  } finally {
    await client.end();
    await admin.unsafe(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
