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

test("WA templates are read from each WABA via Graph and tagged per channel", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), auth: init?.headers?.Authorization });
    return new Response(JSON.stringify({
      data: [
        { id: "1", name: "hello", language: "id", status: "APPROVED", category: "UTILITY",
          components: [{ type: "BODY", text: "Halo {{1}}, pesanan {{2}} {{1}}" }] },
        { id: "2", name: "promo", language: "id", status: "PENDING", category: "MARKETING",
          components: [{ type: "BODY", text: "Promo" }] },
      ],
    }), { status: 200 });
  };
  try {
    const wa = loadTS("lib/wa-templates.ts", {
      "./db": { db: { query: { channels: { findMany: async () => [
        { id: "ch1", name: "Toko", credentials: { waba_id: "W1", access_token: "T1" } },
        { id: "ch2", name: "Tanpa WABA", credentials: { phone_number_id: "P2" } },
      ] } } } },
      "./db/schema": { channels: {} },
      "drizzle-orm": { and: () => null, eq: () => null },
      "./channel-crypto": { decryptCreds: (c) => c },
    });
    const res = await wa.listWaTemplates("tenant", { status: "approved" });
    assert.deepEqual(res.errors, []);
    assert.equal(res.templates.length, 1);
    assert.equal(res.templates[0].name, "hello");
    assert.equal(res.templates[0].channelId, "ch1");
    assert.equal(res.templates[0].variableCount, 2);
    assert.equal(calls.length, 1, "channel without WABA credentials must be skipped");
    assert.match(calls[0].url, /\/W1\/message_templates/);
    assert.equal(calls[0].auth, "Bearer T1");
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

test("flow graph compiles menu/condition to engine nodes and validates wiring", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const graph = {
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "keyword", keywords: ["halo"] } },
      { id: "m", type: "menu", position: { x: 0, y: 0 }, data: {
        prompt: "Pilih", saveAs: "pilihan", invalidText: "Ulangi",
        options: [{ id: "a", code: "A", label: "Info" }, { id: "b", code: "B", label: "Agen" }] } },
      { id: "c", type: "condition", position: { x: 0, y: 0 }, data: { variable: "pesan", rules: [{ id: "r1", op: "contains", value: "it's" }] } },
      { id: "s", type: "send_text", position: { x: 0, y: 0 }, data: { text: "Info" } },
      { id: "h", type: "handoff", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: "1", source: "t", sourceHandle: "out", target: "m" },
      { id: "2", source: "m", sourceHandle: "opt:a", target: "c" },
      { id: "3", source: "m", sourceHandle: "opt:b", target: "h" },
      { id: "4", source: "c", sourceHandle: "rule:r1", target: "s" },
    ],
  };
  assert.deepEqual(fg.validateGraph(graph), []);
  const { nodes, trigger } = fg.compileGraph(graph);
  assert.equal(trigger, "keyword");
  assert.equal(fg.validateRuntimeNodes(nodes), null);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  assert.deepEqual(byId.t.trigger, { kind: "keyword", match: ["halo"] });
  assert.equal(byId.m.next, "m__wait");
  assert.equal(byId["m__wait"].normalize, "choice");
  assert.deepEqual(byId["m__branch"].branches.map((b) => [b.if, b.next]), [
    ["pilihan == 'a'", "c"], ["pilihan == 'info'", "c"], ["pilihan == 'b'", "h"], ["pilihan == 'agen'", "h"],
  ]);
  assert.equal(byId["m__invalid"].next, "m", "unconnected 'invalid' loops back to the menu");
  assert.equal(byId.c.branches[0].if, "pesan contains 'its'", "quotes are stripped from literals");
  assert.equal(byId.c.else, null);

  // Unconnected option + orphan node are reported on the right nodes.
  const broken = { ...graph, edges: graph.edges.filter((e) => e.id !== "3" && e.id !== "4") };
  const issues = fg.validateGraph(broken);
  assert.ok(issues.some((i) => i.nodeId === "m" && /disambungkan/.test(i.message)));
  assert.ok(issues.some((i) => i.nodeId === "h" && /tidak tersambung/.test(i.message)));

  // Round trip: runtime → graph → runtime keeps behaviour for legacy flows.
  const legacy = fg.loadGraph({ nodes: [
    { id: "start", type: "trigger", trigger: { kind: "welcome", match: [] }, next: "x" },
    { id: "x", type: "condition", branches: [{ if: "pesan == 'harga'", next: "y" }], else: null },
    { id: "y", type: "send_text", text: "Harga mulai 10rb" },
  ] });
  const again = fg.compileGraph(legacy).nodes;
  assert.equal(fg.validateRuntimeNodes(again), null);
  assert.equal(again.find((n) => n.id === "x").branches[0].next, "y");
  assert.equal(fg.validateRuntimeNodes([{ id: "a", type: "trigger", next: "missing" }]), "Sambungan ke langkah yang tidak ada (a)");
});

test("flow graph: button trigger, tag step and menu buttons compile for the engine", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const graph = {
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "button", keywords: ["Mau Daftar Offline"] } },
      { id: "g", type: "add_tag", position: { x: 0, y: 0 }, data: { tags: ["daftar-offline"] } },
      { id: "m", type: "menu", position: { x: 0, y: 0 }, data: {
        prompt: "Pilih sesi", saveAs: "sesi", invalidText: "Ulangi",
        options: [{ id: "a", code: "A", label: "Pagi" }, { id: "b", code: "B", label: "Siang" }] } },
      { id: "h", type: "handoff", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: "1", source: "t", sourceHandle: "out", target: "g" },
      { id: "2", source: "g", sourceHandle: "out", target: "m" },
      { id: "3", source: "m", sourceHandle: "opt:a", target: "h" },
      { id: "4", source: "m", sourceHandle: "opt:b", target: "h" },
    ],
  };
  assert.deepEqual(fg.validateGraph(graph), []);
  const { nodes, trigger } = fg.compileGraph(graph);
  assert.equal(trigger, "button");
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  assert.deepEqual(byId.t.trigger, { kind: "button", match: ["Mau Daftar Offline"] });
  assert.deepEqual(byId.g, { id: "g", type: "add_tag", tags: ["daftar-offline"], next: "m" });
  assert.deepEqual(byId.m.buttons, [{ id: "A", title: "Pagi" }, { id: "B", title: "Siang" }]);
  assert.equal(fg.validateRuntimeNodes(nodes), null);
  const empty = { ...graph, nodes: graph.nodes.map((n) => (n.id === "g" ? { ...n, data: { tags: [] } } : n)) };
  assert.ok(fg.validateGraph(empty).some((i) => i.nodeId === "g"));
});

test("flow AI Agent node carries its own AI settings to the engine and back", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const ai = {
    role: "promosi", tone: "promosi", emoji: "banyak", length: "pendek", greeting: "kak", language: "auto",
    goal: "closing", instructions: "Selalu tawarkan bundling", examples: [{ q: "promo?", a: "Ada kak!" }, { q: "", a: "x" }],
    handoffRules: "", fallbackMessage: "", knowledgeAll: false, documentIds: ["d1"], useCatalog: true, usePromos: true,
  };
  const graph = {
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "welcome", keywords: [] } },
      { id: "a", type: "ai_agent", position: { x: 0, y: 0 }, data: { ai } },
    ],
    edges: [{ id: "1", source: "t", sourceHandle: "out", target: "a" }],
  };
  const node = fg.compileGraph(graph).nodes.find((n) => n.id === "a");
  assert.equal(node.ai.tone, "promosi");
  assert.equal(node.ai.knowledge_all, false);
  assert.deepEqual(node.ai.document_ids, ["d1"]);
  assert.equal(node.ai.examples.length, 1, "empty example pairs are dropped");
  const back = fg.loadGraph({ nodes: fg.compileGraph(graph).nodes }).nodes.find((n) => n.id === "a");
  assert.equal(back.data.ai.instructions, "Selalu tawarkan bundling");
  assert.equal(back.data.ai.tone, "promosi");
  // Older AI nodes without settings open with defaults.
  const legacy = fg.loadGraph({ nodes: [{ id: "t", type: "trigger", trigger: { kind: "welcome" }, next: "a" }, { id: "a", type: "ai_agent" }] });
  assert.equal(legacy.nodes.find((n) => n.id === "a").data.ai.tone, "ramah");
});

test("flow AI node modes: channel assistant, chosen assistant, or own settings", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const mk = (data) => ({
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "welcome", keywords: [], idleHours: 12 } },
      { id: "a", type: "ai_agent", position: { x: 0, y: 0 }, data },
    ],
    edges: [{ id: "1", source: "t", sourceHandle: "out", target: "a" }],
  });
  const ai = fg.defaultData("ai_agent").ai;
  assert.equal(fg.defaultData("ai_agent").mode, "custom", "new AI steps are configured on the step itself");

  // channel: no ai, no agent_id → engine uses channel.ai_agent_id / tenant default
  const ch = fg.compileGraph(mk({ ai, mode: "channel" })).nodes;
  const chNode = ch.find((n) => n.id === "a");
  assert.equal(chNode.ai, undefined);
  assert.equal(chNode.agent_id, undefined);
  assert.equal(fg.loadGraph({ nodes: ch }).nodes.find((n) => n.id === "a").data.mode, "channel");

  // agent: only agent_id goes to the engine; the display name never does
  const ag = fg.compileGraph(mk({ ai, mode: "agent", agentId: "11111111-1111-4111-8111-111111111111", agentName: "CS" })).nodes;
  const agNode = ag.find((n) => n.id === "a");
  assert.equal(agNode.agent_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(agNode.ai, undefined);
  assert.equal(agNode.agentName, undefined);
  const agBack = fg.loadGraph({ nodes: ag }).nodes.find((n) => n.id === "a").data;
  assert.equal(agBack.mode, "agent");
  assert.equal(agBack.agentId, "11111111-1111-4111-8111-111111111111");
  assert.ok(fg.validateGraph(mk({ ai, mode: "agent" })).some((i) => i.nodeId === "a" && /asisten/i.test(i.message)));

  // custom: own settings incl. business info
  const custom = { ...ai, businessInfo: { ...ai.businessInfo, assistantName: "Rina", businessName: "Toko Mulia" } };
  const cu = fg.compileGraph(mk({ ai: custom, mode: "custom" })).nodes;
  const cuNode = cu.find((n) => n.id === "a");
  assert.deepEqual(cuNode.ai.business_info, { assistant_name: "Rina", business_name: "Toko Mulia" });
  const cuBack = fg.loadGraph({ nodes: cu }).nodes.find((n) => n.id === "a").data;
  assert.equal(cuBack.mode, "custom");
  assert.equal(cuBack.ai.businessInfo.assistantName, "Rina");

  // "Awal percakapan" idle hours survive the round trip
  const trig = cu.find((n) => n.type === "trigger");
  assert.equal(trig.trigger.idle_hours, 12);
  assert.equal(fg.loadGraph({ nodes: cu }).nodes.find((n) => n.type === "trigger").data.idleHours, 12);
  const noIdle = fg.compileGraph({ ...mk({ ai, mode: "channel" }), nodes: [{ id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "keyword", keywords: ["x"], idleHours: 12 } }, mk({ ai, mode: "channel" }).nodes[1]] });
  assert.equal(noIdle.nodes.find((n) => n.type === "trigger").trigger.idle_hours, undefined, "idle only for welcome");
});

test("assistant presets and business info map cleanly to the engine", () => {
  const o = loadTS("lib/ai-agent-options.ts");
  const cs = o.presetInput("cs");
  assert.equal(cs.role, "cs");
  assert.match(cs.instructions, /\{\{nama_asisten\}\}/);
  assert.equal(cs.isActive, true);
  assert.equal(o.presetInput("kosong").instructions, "", "blank start has no sample prompt");
  for (const p of o.ASSISTANT_PRESETS) assert.ok(o.presetInput(p.id).instructions.length > 20, `${p.id} has a prompt`);
  const info = { ...o.EMPTY_BUSINESS_INFO, assistantName: " Rina ", hours: "08-21" };
  assert.deepEqual(o.businessToEngine(info), { assistant_name: "Rina", hours: "08-21" });
  assert.equal(o.businessFromEngine({ assistant_name: "Rina", hours: 5 }).hours, "");
});

test("flow AI node 'Perlu CS' branch compiles, validates and reloads", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const graph = {
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "welcome", keywords: [] } },
      { id: "a", type: "ai_agent", position: { x: 0, y: 0 }, data: { ai: {} } },
      { id: "h", type: "handoff", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: "1", source: "t", sourceHandle: "out", target: "a" },
      { id: "2", source: "a", sourceHandle: "handoff", target: "h" },
    ],
  };
  const handles = fg.outputHandles(graph.nodes[1]).map((h) => h.id);
  assert.deepEqual(handles, ["out", "handoff"]);
  const compiled = fg.compileGraph(graph).nodes;
  const ai = compiled.find((n) => n.id === "a");
  assert.equal(ai.handoff_next, "h");
  assert.equal(ai.next, null);
  assert.equal(fg.validateRuntimeNodes(compiled), null);
  assert.match(fg.validateRuntimeNodes(compiled.map((n) => (n.id === "a" ? { ...n, handoff_next: "zzz" } : n))), /Perlu CS/);
  const back = fg.loadGraph({ nodes: compiled });
  assert.ok(back.edges.some((e) => e.source === "a" && e.sourceHandle === "handoff" && e.target === "h"));
});

test("every flow template builds a valid, compilable graph", () => {
  const tpl = loadTS("lib/flow-templates.ts");
  const fg = loadTS("lib/flow-graph.ts");
  assert.ok(tpl.FLOW_TEMPLATES.length >= 8);
  const ids = new Set();
  for (const t of tpl.FLOW_TEMPLATES) {
    assert.ok(!ids.has(t.id), `duplicate template id ${t.id}`);
    ids.add(t.id);
    const graph = t.build();
    // Broadcast templates need the user's own account/template before they validate.
    const pending = /akun WhatsApp pengirim|Isi pesan broadcast/;
    const issues = fg.validateGraph(graph).filter((i) => !(t.category === "broadcast" && pending.test(i.message)));
    assert.deepEqual(issues, [], `${t.id} has editor issues`);
    const compiled = fg.compileGraph(graph);
    assert.equal(fg.validateRuntimeNodes(compiled.nodes), null, `${t.id} runtime invalid`);
    // Reload keeps every node (templates stay editable).
    assert.equal(fg.loadGraph({ nodes: compiled.nodes, ui: graph }).nodes.length, graph.nodes.length);
  }
  // Welcome templates greet returning customers too; general AI steps follow the channel's assistant.
  for (const id of ["welcome-menu", "natural-greeting-ai", "menu-ai-hybrid"]) {
    const trig = fg.compileGraph(tpl.findTemplate(id).build()).nodes.find((n) => n.type === "trigger");
    assert.equal(trig.trigger.idle_hours, 12, `${id} idle hours`);
  }
  // AI steps carry their own friendly-CS settings (no separate assistant menu needed).
  for (const id of ["ai-faq", "natural-greeting-ai", "menu-ai-hybrid"]) {
    const bot = fg.compileGraph(tpl.findTemplate(id).build()).nodes.find((n) => n.type === "ai_agent");
    assert.ok(bot?.ai, `${id} has its own AI settings`);
    assert.equal(bot.ai.role, "cs");
    assert.equal(bot.ai.tone, "ramah");
    assert.match(bot.ai.instructions, /Customer Service/);
  }
  assert.ok(fg.compileGraph(tpl.findTemplate("ai-complaint").build()).nodes.find((n) => n.type === "ai_agent").ai, "complaint keeps its own style");
  const c2d = tpl.findTemplate("comment-to-dm").build();
  const trig = fg.compileGraph(c2d).nodes.find((n) => n.type === "trigger");
  assert.equal(trig.trigger.kind, "comment");
  assert.ok(trig.trigger.match.includes("info"));
});

test("Excel/CSV import maps columns and rupiah prices", () => {
  const ti = loadTS("lib/table-import.ts");
  for (const [raw, want] of [["Rp150.000", 150000], ["150,000", 150000], ["1.250.000", 1250000], ["150000", 150000], ["150000.0", 150000], ["Rp 99.000", 99000], ["", NaN], ["gratis", NaN]]) {
    assert.ok(Object.is(ti.parseRupiah(raw), want) || ti.parseRupiah(raw) === want, `${raw} → ${ti.parseRupiah(raw)}`);
  }
  const p = ti.rowsToProducts(
    ["Nama Produk", "Harga (Rp)", "Stok", "Kode", "Kategori", "Keterangan"],
    [["Susu Bebelac", "Rp150.000", "12", "SUS-1", "Susu", "0-6 bulan"], ["", "1000", "", "", "", ""], ["Popok", "mahal", "1", "", "", ""], ["Baju", "50.000", "", "", "", ""]],
  );
  assert.deepEqual(p.missing, []);
  assert.deepEqual(p.items[0], { name: "Susu Bebelac", priceIdr: 150000, stock: 12, sku: "SUS-1", category: "Susu", description: "0-6 bulan" });
  assert.equal(p.items[1].stock, 0, "empty stock = 0");
  assert.deepEqual(p.errors.map((e) => e.row), [3, 4], "row numbers match the spreadsheet (header = row 1)");
  assert.deepEqual(ti.rowsToProducts(["Judul", "Nilai"], [["a", "b"]]).missing, ["Nama", "Harga"]);

  const f = ti.rowsToFaqs(["Pertanyaan", "Jawaban"], [["Bisa COD?", "Bisa"], ["ok", "x"], ["Jam buka?", ""]]);
  assert.equal(f.items.length, 1);
  assert.equal(f.errors.length, 2);
  // The downloadable templates import cleanly.
  const csv = (t) => t.trim().split("\n").map((l) => l.match(/("[^"]*"|[^,]+)/g).map((c) => c.replace(/^"|"$/g, "")));
  const [ph, ...pr] = csv(ti.TEMPLATE_CSV.products);
  assert.equal(ti.rowsToProducts(ph, pr).items.length, 2);
  const [fh, ...fr] = csv(ti.TEMPLATE_CSV.faqs);
  assert.equal(ti.rowsToFaqs(fh, fr).items.length, 2);
});

test("disabled flow steps are skipped at runtime and not validated", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const node = (id, type, data, extra = {}) => ({ id, type, position: { x: 0, y: 0 }, data, ...extra });
  const graph = {
    nodes: [
      node("t", "trigger", { kind: "keyword", keywords: ["halo"] }),
      node("a", "send_text", { text: "Pesan A" }),
      node("b", "send_text", { text: "" }, { disabled: true }), // empty text would be an issue if active
      node("c", "send_text", { text: "Pesan C" }),
    ],
    edges: [
      { id: "1", source: "t", sourceHandle: "out", target: "a" },
      { id: "2", source: "a", sourceHandle: "out", target: "b" },
      { id: "3", source: "b", sourceHandle: "out", target: "c" },
    ],
  };
  const compiled = fg.compileGraph(graph).nodes;
  assert.equal(compiled.find((n) => n.id === "b"), undefined, "disabled step is not sent to the engine");
  assert.equal(compiled.find((n) => n.id === "a").next, "c", "flow continues after the disabled step");
  assert.equal(fg.validateRuntimeNodes(compiled), null);
  assert.ok(!fg.validateGraph(graph).some((i) => i.nodeId === "b"), "disabled step is not validated");

  // First step off → the trigger jumps over it; last step off → the path ends there.
  const firstOff = { ...graph, nodes: graph.nodes.map((n) => (n.id === "a" ? { ...n, disabled: true } : n)) };
  assert.equal(fg.compileGraph(firstOff).nodes.find((n) => n.id === "t").next, "c");
  const lastOff = { ...graph, nodes: graph.nodes.map((n) => (n.id === "c" ? { ...n, disabled: true } : n.id === "b" ? { ...n, disabled: false } : n)) };
  assert.equal(fg.compileGraph(lastOff).nodes.find((n) => n.id === "b").next, null);
  // The canvas keeps the flag (saved in definition.ui) so the step can be turned back on.
  assert.equal(fg.loadGraph({ nodes: compiled, ui: graph }).nodes.find((n) => n.id === "b").disabled, true);
});

test("one account, one flow per trigger: conflicts and taken accounts", () => {
  const fc = loadTS("lib/flow-conflicts.ts");
  const flow = (id, kind, channels = [], keywords = [], posts = []) => ({ id, name: id, kind, channels, keywords, posts });
  const name = (id) => `"${id}"`;
  const others = [flow("sambutan", "welcome", ["wa1"]), flow("promo", "keyword", ["wa1"], ["promo"]), flow("all-fb", "fallback")];

  // Same catch-all trigger on the same account → conflict; another account is free.
  assert.equal(fc.findFlowConflicts(flow("new", "welcome", ["wa1"]), others, name).length, 1);
  assert.equal(fc.findFlowConflicts(flow("new", "welcome", ["wa2"]), others, name).length, 0);
  // "Semua akun" overlaps every account.
  assert.equal(fc.findFlowConflicts(flow("new", "welcome", []), others, name)[0].account, '"wa1"');
  assert.equal(fc.findFlowConflicts(flow("new", "fallback", ["wa9"]), others, name)[0].account, '"wa9"', "other flow covers all accounts");
  assert.equal(fc.findFlowConflicts(flow("new", "fallback", []), others, name)[0].account, "semua akun");
  // Keywords only clash when a word is shared on a shared account.
  assert.equal(fc.findFlowConflicts(flow("new", "keyword", ["wa1"], ["harga"]), others, name).length, 0);
  assert.match(fc.conflictMessage(fc.findFlowConflicts(flow("new", "keyword", [], ["promo"]), others, name)[0]), /promo/);
  // A flow never conflicts with itself; broadcasts never compete.
  assert.equal(fc.findFlowConflicts(flow("sambutan", "welcome", ["wa1"]), others, name).length, 0);
  assert.equal(fc.findFlowConflicts(flow("b", "broadcast", ["wa1"]), [flow("b2", "broadcast", ["wa1"])], name).length, 0);
  // Comment flows: different posts don't clash.
  assert.equal(fc.findFlowConflicts(flow("c", "comment", ["fb"], [], ["p1"]), [flow("c2", "comment", ["fb"], [], ["p2"])], name).length, 0);
  assert.equal(fc.findFlowConflicts(flow("c", "comment", ["fb"]), [flow("c2", "comment", ["fb"])], name).length, 1);

  // Picker: accounts held by another flow of the same catch-all trigger.
  const taken = fc.takenAccounts("welcome", "new", others);
  assert.equal(taken.get("wa1"), "sambutan");
  assert.equal(fc.takenAccounts("fallback", "new", others).get("*"), "all-fb");
  assert.equal(fc.takenAccounts("keyword", "new", others).size, 0);

  // Trigger info is read from the saved runtime trigger node.
  const info = fc.triggerInfo({ id: "x", name: "X", trigger: "keyword", definition: { nodes: [{ type: "trigger", trigger: { kind: "keyword", match: ["Promo "], channels: ["wa1"] } }] } });
  assert.deepEqual([info.kind, info.keywords, info.channels], ["keyword", ["promo"], ["wa1"]]);
});

test("broadcast flow: trigger + first message compile with per-button branches", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const msgData = {
    ...fg.defaultData("broadcast_message"),
    template: "promo_nov",
    language: "id",
    headerFormat: "NONE",
    params: [{ id: "p1", source: "contact_name", value: "", fallback: "Kak" }],
    buttons: [
      { id: "b1", index: 0, text: "Mau" },
      { id: "b2", index: 2, text: "Nanti" },
    ],
  };
  const graph = {
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "broadcast", keywords: [], channels: ["wa1"], tags: ["vip"], scheduleAt: "2026-12-01T02:00:00.000Z" } },
      { id: "m", type: "broadcast_message", position: { x: 0, y: 0 }, data: msgData },
      { id: "yes", type: "send_text", position: { x: 0, y: 0 }, data: { text: "Siap" } },
      { id: "cs", type: "handoff", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: "1", source: "t", sourceHandle: "out", target: "m" },
      { id: "2", source: "m", sourceHandle: "btn:b1", target: "yes" },
      { id: "3", source: "m", sourceHandle: "out", target: "cs" },
    ],
  };
  assert.deepEqual(fg.validateGraph(graph), []);
  const { nodes, trigger } = fg.compileGraph(graph);
  assert.equal(trigger, "broadcast");
  const t = nodes.find((n) => n.type === "trigger");
  assert.deepEqual(t.trigger.tags, ["vip"]);
  assert.equal(t.trigger.schedule_at, "2026-12-01T02:00:00.000Z");
  const m = nodes.find((n) => n.type === "broadcast_message");
  assert.deepEqual(m.buttons.map((b) => [b.index, b.next]), [[0, "yes"], [2, null]]);
  assert.equal(m.next, "cs");
  assert.equal(m.template.name, "promo_nov");
  assert.equal(fg.validateRuntimeNodes(nodes), null);
  // Reload keeps the button branch wiring.
  const back = fg.loadGraph({ nodes });
  const bm = back.nodes.find((n) => n.type === "broadcast_message");
  assert.equal(bm.data.buttons.length, 2);
  assert.ok(back.edges.some((e) => e.source === "m" && e.sourceHandle.startsWith("btn:") && e.target === "yes"));

  // First step must be the broadcast message, and only one account.
  const bad = { ...graph, nodes: graph.nodes.map((n) => (n.id === "t" ? { ...n, data: { ...n.data, channels: [] } } : n)) };
  assert.ok(fg.validateGraph(bad).some((i) => /akun WhatsApp/.test(i.message)));
  const wrongFirst = { ...graph, edges: [{ id: "1", source: "t", sourceHandle: "out", target: "yes" }] };
  assert.ok(fg.validateGraph(wrongFirst).some((i) => /Pesan Broadcast/.test(i.message)));
});

test("broadcast schedule input is WIB", () => {
  const bf = loadTS("lib/broadcast-flow.ts");
  assert.equal(bf.wibInputToIso("2026-11-08T09:00"), "2026-11-08T02:00:00.000Z");
  assert.equal(bf.isoToWibInput("2026-11-08T02:00:00.000Z"), "2026-11-08T09:00");
  assert.equal(bf.wibInputToIso("bad"), null);
  assert.equal(
    bf.previewTemplateBody("Hai {{1}}, promo {{2}}", [
      { source: "contact_name", value: "", fallback: "" },
      { source: "static", value: "20%", fallback: "" },
    ]),
    "Hai [Nama kontak], promo 20%",
  );
});

test("comment reply nodes only make sense under a comment trigger", () => {
  const fg = loadTS("lib/flow-graph.ts");
  const graph = {
    nodes: [
      { id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "keyword", keywords: ["x"], channels: ["ch1"] } },
      { id: "r", type: "reply_comment", position: { x: 0, y: 0 }, data: { texts: ["hai"] } },
    ],
    edges: [{ id: "1", source: "t", sourceHandle: "out", target: "r" }],
  };
  assert.ok(fg.validateGraph(graph).some((i) => i.nodeId === "r" && /Komentar/.test(i.message)));
  const trig = fg.compileGraph(graph).nodes.find((n) => n.type === "trigger");
  assert.deepEqual(trig.trigger.channels, ["ch1"], "account filter is compiled for the engine");
  assert.equal(trig.trigger.posts, undefined, "post filter only for comment triggers");
});

test("stale page after a deploy gets a reload hint instead of the raw Next.js error", () => {
  const { errorMessage, isStaleDeploy, STALE_DEPLOY_MESSAGE } = loadTS("lib/action-error.ts");
  const e = new Error('Server Action "60ba30c41d4c35ae9927a1ac944bc6a13c6b8602c9" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action');
  assert.equal(isStaleDeploy(e), true);
  assert.equal(errorMessage(e), STALE_DEPLOY_MESSAGE);
  assert.equal(isStaleDeploy(new Error("Nama flow wajib diisi")), false);
});

test("server action errors stay readable in production (digest round trip)", () => {
  const { userError, errorMessage } = loadTS("lib/action-error.ts");
  const err = userError("Email sudah terdaftar");
  // Simulate what the browser receives in production: masked message, digest kept.
  const masked = new Error("The specific message is omitted in production builds to avoid leaking sensitive details.");
  masked.digest = err.digest;
  assert.equal(errorMessage(masked), "Email sudah terdaftar");
  const unknown = new Error("The specific message is omitted in production builds to avoid leaking sensitive details.");
  unknown.digest = "123456";
  assert.match(errorMessage(unknown), /Terjadi kesalahan di server/);
  assert.equal(errorMessage("x"), undefined);
});

test("self-signup creates a 14-day Pro trial that payment clears", () => {
  const src = readFileSync(path.resolve(root, "lib/actions.ts"), "utf8");
  const reg = src.slice(src.indexOf("export async function register("), src.indexOf("export async function logout("));
  assert.match(reg, /plan: "pro"/);
  assert.match(reg, /TRIAL_DAYS \* 86_400_000/);
  assert.match(reg, /settings: \{ trial: true \}/);
  assert.match(src, /const TRIAL_DAYS = 14;/);
  const cb = readFileSync(path.resolve(root, "app/api/duitku/callback/route.ts"), "utf8");
  assert.match(cb, /trial: false/, "paying ends the trial");
});

test("chat attachments: only safe file types, WhatsApp-sized limits", () => {
  const a = loadTS("lib/chat-attachments.ts");
  const mimes = Object.keys(a.CHAT_MIME);
  for (const bad of ["text/html", "image/svg+xml", "application/javascript", "application/x-msdownload"]) {
    assert.ok(!mimes.includes(bad), `${bad} must not be uploadable`);
  }
  assert.equal(a.attachmentKind("image/png"), "image");
  assert.equal(a.attachmentKind("application/pdf"), "document");
  assert.equal(a.CHAT_MAX_BYTES.image, 5 * 1024 * 1024);
  assert.equal(a.formatBytes(1536), "2 KB");
});

// Tenant isolation: every domain table referenced in the dashboard SQL must carry a
// `<alias>.tenant_id = ${t}` filter in the same query (joins included), so one
// tenant's dashboard can never count another tenant's rows.
test("tenant dashboard: every table alias is filtered by tenant_id", () => {
  const src = readFileSync(path.join(root, "lib/tenant-dashboard.ts"), "utf8");
  // Drop tiny nested templates (sql`m.created_at`, sql``) so each query block parses whole.
  const flat = src.replace(/sql`[\w.]*`/g, "X");
  const blocks = flat.match(/sql`[\s\S]*?`/g) ?? [];
  const TABLES = "messages|conversations|contacts|channels|broadcasts|broadcast_recipients|ai_usage|users";
  const ref = new RegExp(`\\b(?:from|join)\\s+(${TABLES})\\s+(?:as\\s+)?([a-z_]+)`, "gi");
  let checked = 0;
  for (const block of blocks) {
    for (const [, table, alias] of block.matchAll(ref)) {
      checked++;
      assert.ok(
        new RegExp(`\\b${alias}\\.tenant_id\\s*=\\s*\\$\\{t\\}`).test(block),
        `${table} ${alias} is not filtered by ${alias}.tenant_id = \${t} in:\n${block.slice(0, 200)}`,
      );
    }
    // Tables must always be aliased, otherwise the rule above cannot see them.
    assert.ok(!new RegExp(`\\b(?:from|join)\\s+(${TABLES})\\s*(?:where|on|\\)|$)`, "i").test(block), `unaliased table in:\n${block.slice(0, 200)}`);
  }
  assert.ok(checked >= 20, `expected many table references, found ${checked}`);
  // The tenant id must come from the caller (session), never from URL filters.
  assert.match(src, /export async function loadTenantDashboard\(tenantId: string, f: DashboardFilters\)/);
  const page = readFileSync(path.join(root, "app/(app)/dashboard/page.tsx"), "utf8");
  assert.match(page, /loadTenantDashboard\(session\.tenantId/);
});

test("tenant dashboard: URL filters are whitelisted", () => {
  const mod = loadTS("lib/tenant-dashboard.ts", { "@/lib/db": { db: {} }, "drizzle-orm": { sql: () => ({}) } });
  assert.deepEqual(mod.parseFilters({ range: "30d", ch: "instagram" }), { range: "30d", days: 30, channel: "instagram" });
  assert.deepEqual(mod.parseFilters({ range: "1; drop table", ch: "x' or 1=1" }), { range: "7d", days: 7, channel: null });
  assert.deepEqual(mod.parseFilters({}), { range: "7d", days: 7, channel: null });
});

test("meta signed_request: valid signature parses, tampering is rejected", async () => {
  const { createHmac } = await import("node:crypto");
  const mod = loadTS("lib/meta-signed-request.ts");
  const secret = "app-secret";
  const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sign = (obj, key = secret) => {
    const payload = b64u(JSON.stringify(obj));
    return `${b64u(createHmac("sha256", key).update(payload).digest())}.${payload}`;
  };
  const good = sign({ algorithm: "HMAC-SHA256", user_id: "123", issued_at: 1700000000 });
  assert.deepEqual(mod.parseSignedRequest(good, secret), { user_id: "123", algorithm: "HMAC-SHA256", issued_at: 1700000000 });
  assert.equal(mod.parseSignedRequest(sign({ algorithm: "HMAC-SHA256", user_id: "123" }, "other"), secret), null, "wrong secret");
  const [sig, payload] = good.split(".");
  const forged = `${sig}.${b64u(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "999" }))}`;
  assert.equal(mod.parseSignedRequest(forged, secret), null, "payload swapped");
  assert.equal(mod.parseSignedRequest(`${sig}.${payload}.x`, secret), null);
  assert.equal(mod.parseSignedRequest(good, ""), null, "no secret configured");
  assert.equal(mod.parseSignedRequest(sign({ algorithm: "none", user_id: "1" }), secret), null);
  const code = mod.confirmationCode("123", 1700000000, secret);
  assert.match(code, /^DEL-[0-9A-F]{12}$/);
  assert.equal(code, mod.confirmationCode("123", 1700000000, secret));
});
