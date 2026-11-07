// Flow builder graph model (pure, no React — used by the canvas editor, saveFlow and tests).
//
// The canvas edits a graph stored in `definition.ui`. On save it is compiled into
// `definition.nodes`, the runtime format executed by engine/app/pipeline/flow_engine.py:
//   { id, type, next } with type-specific fields (text, save_as, branches, else, ...).
// Older flows (no `definition.ui`) are converted from their runtime nodes on load.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TriggerKind = "keyword" | "welcome" | "fallback";
export type ConditionOp = "equals" | "not_equals" | "contains" | "starts_with" | "is_empty" | "not_empty";

export type MenuOption = { id: string; code: string; label: string };
export type ConditionRule = { id: string; op: ConditionOp; value: string };
export type VarPair = { id: string; key: string; value: string };

export type NodeDataMap = {
  trigger: { kind: TriggerKind; keywords: string[] };
  send_text: { text: string };
  send_media: { url: string; caption: string };
  send_catalog: { category: string; intro: string };
  menu: { prompt: string; saveAs: string; invalidText: string; options: MenuOption[] };
  wait_reply: { saveAs: string };
  condition: { variable: string; rules: ConditionRule[] };
  set_var: { pairs: VarPair[] };
  ai_agent: Record<string, never>;
  handoff: Record<string, never>;
};

export type NodeKind = keyof NodeDataMap;

export type GraphNode<K extends NodeKind = NodeKind> = {
  id: string;
  type: K;
  position: { x: number; y: number };
  data: NodeDataMap[K];
};

export type GraphEdge = { id: string; source: string; sourceHandle: string; target: string };

export type FlowGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type RuntimeNode = Record<string, any> & { id: string; type: string };

export type FlowIssue = { nodeId: string | null; message: string };

export const VAR_RE = /^[a-zA-Z0-9_]+$/;

export const CONDITION_OPS: { value: ConditionOp; label: string; needsValue: boolean }[] = [
  { value: "equals", label: "sama dengan", needsValue: true },
  { value: "not_equals", label: "tidak sama dengan", needsValue: true },
  { value: "contains", label: "mengandung", needsValue: true },
  { value: "starts_with", label: "diawali", needsValue: true },
  { value: "is_empty", label: "kosong", needsValue: false },
  { value: "not_empty", label: "tidak kosong", needsValue: false },
];

export const KNOWN_RUNTIME_TYPES = new Set([
  "trigger",
  "send_text",
  "send_media",
  "send_catalog",
  "set_var",
  "condition",
  "ai_agent",
  "wait_reply",
  "handoff",
  "call_tool",
]);

let seq = 0;
export function newId(prefix = "n"): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultData<K extends NodeKind>(kind: K): NodeDataMap[K] {
  const d: { [P in NodeKind]: NodeDataMap[P] } = {
    trigger: { kind: "keyword", keywords: [] },
    send_text: { text: "" },
    send_media: { url: "", caption: "" },
    send_catalog: { category: "", intro: "" },
    menu: {
      prompt: "Silakan pilih:\nA. Informasi\nB. Hubungi agen",
      saveAs: "pilihan",
      invalidText: "Pilihan belum dikenali. Silakan coba lagi.",
      options: [
        { id: newId("o"), code: "A", label: "Informasi" },
        { id: newId("o"), code: "B", label: "Hubungi agen" },
      ],
    },
    wait_reply: { saveAs: "jawaban" },
    condition: { variable: "pesan", rules: [{ id: newId("r"), op: "contains", value: "" }] },
    set_var: { pairs: [{ id: newId("v"), key: "", value: "" }] },
    ai_agent: {},
    handoff: {},
  };
  return structuredClone(d[kind]);
}

// --- Output handles -------------------------------------------------------------------

export type OutputHandle = { id: string; label: string; tone?: "default" | "muted" };

export function outputHandles(node: GraphNode): OutputHandle[] {
  switch (node.type) {
    case "handoff":
      return [];
    case "menu": {
      const d = node.data as NodeDataMap["menu"];
      return [
        ...d.options.map((o) => ({ id: `opt:${o.id}`, label: `${o.code || "?"}. ${o.label || "Pilihan"}` })),
        { id: "invalid", label: "Tidak dikenali", tone: "muted" as const },
      ];
    }
    case "condition": {
      const d = node.data as NodeDataMap["condition"];
      return [
        ...d.rules.map((r) => ({ id: `rule:${r.id}`, label: ruleLabel(d.variable, r) })),
        { id: "else", label: "Lainnya", tone: "muted" as const },
      ];
    }
    default:
      return [{ id: "out", label: "" }];
  }
}

export function ruleLabel(variable: string, r: ConditionRule): string {
  const op = CONDITION_OPS.find((o) => o.value === r.op);
  const v = variable || "?";
  return op?.needsValue ? `${v} ${op.label} "${r.value}"` : `${v} ${op?.label ?? r.op}`;
}

// --- Compile graph → runtime ----------------------------------------------------------

function quote(value: string): string {
  // eval_expr literals use single quotes; strip quotes so the literal can't break out.
  return `'${value.replace(/['"]/g, "")}'`;
}

export function compileGraph(graph: FlowGraph): { nodes: RuntimeNode[]; trigger: TriggerKind } {
  const target = (source: string, handle: string): string | null =>
    graph.edges.find((e) => e.source === source && e.sourceHandle === handle)?.target ?? null;

  const out: RuntimeNode[] = [];
  let trigger: TriggerKind = "keyword";

  for (const node of graph.nodes) {
    const next = target(node.id, "out");
    switch (node.type) {
      case "trigger": {
        const d = node.data as NodeDataMap["trigger"];
        trigger = d.kind;
        out.push({
          id: node.id,
          type: "trigger",
          trigger: { kind: d.kind, match: d.kind === "keyword" ? d.keywords : [] },
          next,
        });
        break;
      }
      case "send_text":
        out.push({ id: node.id, type: "send_text", text: (node.data as NodeDataMap["send_text"]).text, next });
        break;
      case "send_media": {
        const d = node.data as NodeDataMap["send_media"];
        out.push({ id: node.id, type: "send_media", url: d.url, caption: d.caption || undefined, next });
        break;
      }
      case "send_catalog": {
        const d = node.data as NodeDataMap["send_catalog"];
        out.push({
          id: node.id,
          type: "send_catalog",
          category: d.category || undefined,
          intro: d.intro || undefined,
          next,
        });
        break;
      }
      case "wait_reply":
        out.push({ id: node.id, type: "wait_reply", save_as: (node.data as NodeDataMap["wait_reply"]).saveAs, next });
        break;
      case "set_var": {
        const d = node.data as NodeDataMap["set_var"];
        const set: Record<string, string> = {};
        for (const p of d.pairs) if (p.key.trim()) set[p.key.trim()] = p.value;
        out.push({ id: node.id, type: "set_var", set, next });
        break;
      }
      case "condition": {
        const d = node.data as NodeDataMap["condition"];
        out.push({
          id: node.id,
          type: "condition",
          branches: d.rules.map((r) => {
            const op = CONDITION_OPS.find((o) => o.value === r.op);
            const expr = op?.needsValue ? `${d.variable} ${r.op} ${quote(r.value)}` : `${d.variable} ${r.op}`;
            return { if: expr, next: target(node.id, `rule:${r.id}`) };
          }),
          else: target(node.id, "else"),
        });
        break;
      }
      case "menu": {
        // Same runtime shape as the old "choice_menu": prompt → wait (normalized) → branch.
        const d = node.data as NodeDataMap["menu"];
        const waitId = `${node.id}__wait`;
        const branchId = `${node.id}__branch`;
        const invalidId = `${node.id}__invalid`;
        out.push({ id: node.id, type: "send_text", text: d.prompt, next: waitId });
        out.push({ id: waitId, type: "wait_reply", save_as: d.saveAs, normalize: "choice", next: branchId });
        out.push({
          id: branchId,
          type: "condition",
          branches: d.options.flatMap((o) => {
            const to = target(node.id, `opt:${o.id}`);
            const aliases = [...new Set([o.code, o.label].map((v) => v.trim().toLocaleLowerCase()).filter(Boolean))];
            return aliases.map((v) => ({ if: `${d.saveAs} == ${quote(v)}`, next: to }));
          }),
          else: invalidId,
        });
        out.push({ id: invalidId, type: "send_text", text: d.invalidText, next: target(node.id, "invalid") ?? node.id });
        break;
      }
      case "ai_agent":
        out.push({ id: node.id, type: "ai_agent", next });
        break;
      case "handoff":
        out.push({ id: node.id, type: "handoff", to: "agent" });
        break;
    }
  }
  return { nodes: out, trigger };
}

// --- Validation (editor) --------------------------------------------------------------

export function validateGraph(graph: FlowGraph): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const add = (nodeId: string | null, message: string) => issues.push({ nodeId, message });
  const triggers = graph.nodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0) add(null, "Flow butuh satu Pemicu");
  if (triggers.length > 1) triggers.slice(1).forEach((t) => add(t.id, "Hanya boleh satu Pemicu"));

  const hasEdge = (id: string, handle: string) => graph.edges.some((e) => e.source === id && e.sourceHandle === handle);

  for (const node of graph.nodes) {
    switch (node.type) {
      case "trigger": {
        const d = node.data as NodeDataMap["trigger"];
        if (d.kind === "keyword" && d.keywords.length === 0) add(node.id, "Tambahkan minimal satu keyword");
        if (!hasEdge(node.id, "out")) add(node.id, "Sambungkan Pemicu ke langkah pertama");
        break;
      }
      case "send_text":
        if (!(node.data as NodeDataMap["send_text"]).text.trim()) add(node.id, "Isi pesan masih kosong");
        break;
      case "send_media":
        if (!/^https?:\/\//.test((node.data as NodeDataMap["send_media"]).url.trim()))
          add(node.id, "URL media harus diawali http(s)://");
        break;
      case "wait_reply":
        if (!VAR_RE.test((node.data as NodeDataMap["wait_reply"]).saveAs))
          add(node.id, "Nama variabel hanya huruf, angka, underscore");
        break;
      case "set_var": {
        const d = node.data as NodeDataMap["set_var"];
        const keys = d.pairs.filter((p) => p.key.trim());
        if (keys.length === 0) add(node.id, "Isi minimal satu variabel");
        if (keys.some((p) => !VAR_RE.test(p.key.trim()))) add(node.id, "Nama variabel hanya huruf, angka, underscore");
        break;
      }
      case "condition": {
        const d = node.data as NodeDataMap["condition"];
        if (!VAR_RE.test(d.variable)) add(node.id, "Pilih variabel yang dicek");
        if (d.rules.length === 0) add(node.id, "Tambahkan minimal satu aturan");
        for (const r of d.rules) {
          const op = CONDITION_OPS.find((o) => o.value === r.op);
          if (op?.needsValue && !r.value.trim()) add(node.id, "Isi nilai pembanding di setiap aturan");
          if (!hasEdge(node.id, `rule:${r.id}`)) add(node.id, "Setiap aturan harus disambungkan");
        }
        break;
      }
      case "menu": {
        const d = node.data as NodeDataMap["menu"];
        if (!d.prompt.trim()) add(node.id, "Pesan menu masih kosong");
        if (!VAR_RE.test(d.saveAs)) add(node.id, "Nama variabel hanya huruf, angka, underscore");
        if (d.options.length < 2 || d.options.length > 10) add(node.id, "Menu harus punya 2–10 pilihan");
        const codes = d.options.map((o) => o.code.trim().toLowerCase());
        if (codes.some((c) => !c) || d.options.some((o) => !o.label.trim()))
          add(node.id, "Setiap pilihan butuh kode dan label");
        if (new Set(codes).size !== codes.length) add(node.id, "Kode pilihan harus unik");
        if (d.options.some((o) => !hasEdge(node.id, `opt:${o.id}`))) add(node.id, "Setiap pilihan harus disambungkan");
        break;
      }
    }
  }

  // Every node must be reachable from the trigger, otherwise it never runs.
  if (triggers.length === 1) {
    const seen = new Set<string>([triggers[0].id]);
    const queue = [triggers[0].id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of graph.edges) {
        if (e.source === id && !seen.has(e.target)) {
          seen.add(e.target);
          queue.push(e.target);
        }
      }
    }
    for (const n of graph.nodes) if (!seen.has(n.id)) add(n.id, "Langkah ini tidak tersambung dari Pemicu");
  }
  return issues;
}

// --- Validation (server, runtime nodes) ----------------------------------------------

export function validateRuntimeNodes(nodes: unknown): string | null {
  if (!Array.isArray(nodes) || nodes.length === 0) return "Flow kosong";
  const ids = new Set<string>();
  for (const n of nodes as RuntimeNode[]) {
    if (!n || typeof n.id !== "string" || !n.id) return "Node tanpa id";
    if (ids.has(n.id)) return `Id node duplikat: ${n.id}`;
    ids.add(n.id);
    if (!KNOWN_RUNTIME_TYPES.has(n.type)) return `Tipe node tidak dikenal: ${String(n.type)}`;
  }
  const triggers = (nodes as RuntimeNode[]).filter((n) => n.type === "trigger");
  if (triggers.length !== 1) return "Flow harus punya tepat satu Pemicu";
  const refOk = (ref: unknown) => ref == null || (typeof ref === "string" && ids.has(ref));
  for (const n of nodes as RuntimeNode[]) {
    if (!refOk(n.next)) return `Sambungan ke langkah yang tidak ada (${n.id})`;
    if (n.type === "condition") {
      if (!Array.isArray(n.branches)) return `Kondisi tanpa cabang (${n.id})`;
      for (const b of n.branches) {
        if (typeof b?.if !== "string" || !refOk(b.next)) return `Cabang kondisi tidak valid (${n.id})`;
      }
      if (!refOk(n.else)) return `Cabang 'lainnya' tidak valid (${n.id})`;
    }
    if (n.type === "wait_reply" && (typeof n.save_as !== "string" || !VAR_RE.test(n.save_as)))
      return `Nama variabel tidak valid (${n.id})`;
  }
  return null;
}

// --- Load: definition → graph ---------------------------------------------------------

function isGraph(ui: any): ui is FlowGraph {
  return ui && Array.isArray(ui.nodes) && Array.isArray(ui.edges);
}

const OP_RE = /^\s*([a-zA-Z0-9_]+)\s+(equals|not_equals|contains|starts_with|is_empty|not_empty)\b\s*([\s\S]*)$/;

function parseExpr(expr: string): { variable: string; op: ConditionOp; value: string } {
  const m = OP_RE.exec(expr ?? "");
  const unq = (s: string) => s.trim().replace(/^['"]|['"]$/g, "");
  if (m) return { variable: m[1], op: m[2] as ConditionOp, value: unq(m[3] ?? "") };
  for (const [sym, op] of [["!=", "not_equals"], ["==", "equals"]] as const) {
    if (expr?.includes(sym)) {
      const [l, r] = expr.split(sym, 2);
      return { variable: l.trim(), op, value: unq(r) };
    }
  }
  return { variable: "pesan", op: "equals", value: "" };
}

// Simple top-down layout: depth from the trigger → row; order within a row → column.
export function autoLayout(graph: FlowGraph): FlowGraph {
  const trigger = graph.nodes.find((n) => n.type === "trigger");
  const depth = new Map<string, number>();
  if (trigger) {
    depth.set(trigger.id, 0);
    const queue = [trigger.id];
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of graph.edges.filter((x) => x.source === id)) {
        if (!depth.has(e.target)) {
          depth.set(e.target, depth.get(id)! + 1);
          queue.push(e.target);
        }
      }
    }
  }
  const maxDepth = Math.max(0, ...depth.values());
  const rows = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const d = depth.get(n.id) ?? maxDepth + 1;
    rows.set(d, [...(rows.get(d) ?? []), n.id]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of rows) {
    ids.forEach((id, i) => pos.set(id, { x: (i - (ids.length - 1) / 2) * 320, y: d * 190 }));
  }
  return { ...graph, nodes: graph.nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })) };
}

function edge(source: string, sourceHandle: string, target: string | null | undefined): GraphEdge[] {
  return target ? [{ id: `e_${source}_${sourceHandle}_${target}`, source, sourceHandle, target }] : [];
}

// Old list-editor menu flow (definition.menu) → trigger → menu → one reply per option.
function fromLegacyMenu(definition: any): FlowGraph {
  const trig = (definition.nodes ?? []).find((n: any) => n?.type === "trigger");
  const triggerNode: GraphNode<"trigger"> = {
    id: "start",
    type: "trigger",
    position: { x: 0, y: 0 },
    data: { kind: trig?.trigger?.kind ?? "welcome", keywords: trig?.trigger?.match ?? [] },
  };
  const m = definition.menu;
  const options: MenuOption[] = (Array.isArray(m.options) ? m.options : []).map((o: any) => ({
    id: newId("o"),
    code: String(o.code ?? ""),
    label: String(o.label ?? ""),
  }));
  const menu: GraphNode<"menu"> = {
    id: "menu",
    type: "menu",
    position: { x: 0, y: 0 },
    data: {
      prompt: String(m.prompt ?? ""),
      saveAs: String(m.saveAs ?? "pilihan"),
      invalidText: String(m.invalidText ?? "Pilihan belum dikenali. Silakan coba lagi."),
      options,
    },
  };
  const replies: GraphNode<"send_text">[] = options.map((o, i) => ({
    id: `reply_${i}`,
    type: "send_text",
    position: { x: 0, y: 0 },
    data: { text: String(m.options[i]?.response ?? "") },
  }));
  return autoLayout({
    nodes: [triggerNode, menu, ...replies],
    edges: [
      ...edge("start", "out", "menu"),
      ...options.flatMap((o, i) => edge("menu", `opt:${o.id}`, replies[i].id)),
    ],
  });
}

// Generic: runtime nodes → graph (lossless for every node type the engine runs).
function fromRuntime(nodes: RuntimeNode[]): FlowGraph {
  const gNodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const at = { x: 0, y: 0 };
  for (const n of nodes) {
    switch (n.type) {
      case "trigger":
        gNodes.push({ id: n.id, type: "trigger", position: at, data: { kind: n.trigger?.kind ?? "keyword", keywords: n.trigger?.match ?? [] } });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "send_text":
        gNodes.push({ id: n.id, type: "send_text", position: at, data: { text: String(n.text ?? "") } });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "send_media":
        gNodes.push({ id: n.id, type: "send_media", position: at, data: { url: String(n.url ?? n.media_url ?? ""), caption: String(n.caption ?? "") } });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "send_catalog":
        gNodes.push({ id: n.id, type: "send_catalog", position: at, data: { category: String(n.category ?? ""), intro: String(n.intro ?? "") } });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "wait_reply":
        gNodes.push({ id: n.id, type: "wait_reply", position: at, data: { saveAs: String(n.save_as ?? "jawaban") } });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "set_var":
        gNodes.push({
          id: n.id,
          type: "set_var",
          position: at,
          data: { pairs: Object.entries(n.set ?? {}).map(([key, value]) => ({ id: newId("v"), key, value: String(value) })) },
        });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "condition": {
        const parsed = (n.branches ?? []).map((b: any) => ({ ...parseExpr(b.if), next: b.next }));
        const rules: ConditionRule[] = parsed.map((p: any) => ({ id: newId("r"), op: p.op, value: p.value }));
        gNodes.push({ id: n.id, type: "condition", position: at, data: { variable: parsed[0]?.variable ?? "pesan", rules } });
        rules.forEach((r, i) => edges.push(...edge(n.id, `rule:${r.id}`, parsed[i].next)));
        edges.push(...edge(n.id, "else", n.else));
        break;
      }
      case "ai_agent":
        gNodes.push({ id: n.id, type: "ai_agent", position: at, data: {} });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "handoff":
        gNodes.push({ id: n.id, type: "handoff", position: at, data: {} });
        break;
    }
  }
  return autoLayout({ nodes: gNodes, edges });
}

export function starterGraph(): FlowGraph {
  const t: GraphNode<"trigger"> = { id: "start", type: "trigger", position: { x: 0, y: 0 }, data: { kind: "welcome", keywords: [] } };
  const s: GraphNode<"send_text"> = {
    id: newId(),
    type: "send_text",
    position: { x: 0, y: 190 },
    data: { text: "Halo {{nama}} 👋 terima kasih sudah menghubungi kami." },
  };
  return { nodes: [t, s], edges: edge(t.id, "out", s.id) };
}

export function loadGraph(definition: any): FlowGraph {
  if (isGraph(definition?.ui)) return { nodes: definition.ui.nodes, edges: definition.ui.edges };
  if (definition?.menu) return fromLegacyMenu(definition);
  const nodes: RuntimeNode[] = Array.isArray(definition?.nodes) ? definition.nodes : [];
  if (nodes.length === 0) return starterGraph();
  return fromRuntime(nodes);
}

// Variables a message can reference: built-ins + everything the flow stores.
export function flowVariables(graph: FlowGraph): string[] {
  const vars = new Set<string>(["nama", "pesan"]);
  for (const n of graph.nodes) {
    if (n.type === "wait_reply") vars.add((n.data as NodeDataMap["wait_reply"]).saveAs);
    if (n.type === "menu") vars.add((n.data as NodeDataMap["menu"]).saveAs);
    if (n.type === "set_var") (n.data as NodeDataMap["set_var"]).pairs.forEach((p) => p.key.trim() && vars.add(p.key.trim()));
  }
  return [...vars].filter((v) => VAR_RE.test(v));
}
