// Flow builder graph model (pure, no React — used by the canvas editor, saveFlow and tests).
//
// The canvas edits a graph stored in `definition.ui`. On save it is compiled into
// `definition.nodes`, the runtime format executed by engine/app/pipeline/flow_engine.py:
//   { id, type, next } with type-specific fields (text, save_as, branches, else, ...).
// Older flows (no `definition.ui`) are converted from their runtime nodes on load.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DEFAULT_AI_CONFIG, businessFromEngine, businessToEngine, normalizeAiConfig, type AiConfig } from "./ai-agent-options";

export type TriggerKind = "keyword" | "button" | "welcome" | "fallback" | "comment" | "broadcast";
export type ConditionOp = "equals" | "not_equals" | "contains" | "starts_with" | "is_empty" | "not_empty";

export type MenuOption = { id: string; code: string; label: string };
export type ConditionRule = { id: string; op: ConditionOp; value: string };
export type VarPair = { id: string; key: string; value: string };
// How a WA template variable {{n}} is filled per recipient.
export type TemplateParamSource = "static" | "contact_name" | "contact_phone";
export type TemplateParam = { id: string; source: TemplateParamSource; value: string; fallback: string };
// Quick-reply button of the chosen template (index = position among ALL its buttons).
export type BroadcastButton = { id: string; index: number; text: string };

export type NodeDataMap = {
  // channels: limit to these accounts (empty/absent = all). posts: comment trigger only.
  // broadcast: channels = the one WA account that sends, tags = audience (empty = all
  // opted-in contacts), scheduleAt = ISO time (null = send right after activating).
  trigger: {
    kind: TriggerKind;
    keywords: string[];
    channels?: string[];
    posts?: string[];
    tags?: string[];
    scheduleAt?: string | null;
    // welcome only: also restart after the customer was quiet this many hours (0/absent = first message only).
    idleHours?: number;
  };
  // variants: other wordings of the same message; the engine picks one at random.
  send_text: { text: string; variants?: string[] };
  send_media: { url: string; caption: string };
  send_catalog: { category: string; intro: string };
  menu: { prompt: string; saveAs: string; invalidText: string; options: MenuOption[] };
  wait_reply: { saveAs: string };
  condition: { variable: string; rules: ConditionRule[] };
  set_var: { pairs: VarPair[] };
  add_tag: { tags: string[] };
  // mode: "channel" = the channel's assistant (menu Asisten AI), "agent" = a chosen
  // assistant, "custom" = settings on this node only (older nodes have no mode → custom).
  // agentName: display only (not compiled), refreshed from the assistant list on load.
  ai_agent: { ai: AiConfig; mode?: AiNodeMode; agentId?: string; agentName?: string };
  handoff: Record<string, never>;
  reply_comment: { texts: string[] }; // public reply under a FB/IG comment (one picked at random)
  private_reply: { text: string; variants?: string[] }; // one DM to the commenter
  // First message of a broadcast flow. WA unofficial: text (+ optional image);
  // WA official: approved template (+ header media, variables, quick-reply buttons).
  broadcast_message: {
    text: string;
    mediaUrl: string;
    template: string;
    language: string;
    headerFormat: string;
    headerUrl: string;
    params: TemplateParam[];
    buttons: BroadcastButton[];
    saveAs: string;
  };
};

export type AiNodeMode = "channel" | "agent" | "custom";

export function aiNodeMode(d: { mode?: AiNodeMode } | undefined): AiNodeMode {
  return d?.mode === "channel" || d?.mode === "agent" ? d.mode : "custom";
}

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
  "add_tag",
  "condition",
  "ai_agent",
  "wait_reply",
  "handoff",
  "call_tool",
  "reply_comment",
  "private_reply",
  "broadcast_message",
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
    add_tag: { tags: [] },
    ai_agent: { ai: DEFAULT_AI_CONFIG, mode: "channel" },
    handoff: {},
    reply_comment: { texts: ["Terima kasih kak {{nama}}! Info lengkapnya sudah kami kirim lewat DM ya 🙏"] },
    private_reply: { text: "Halo kak {{nama}}, terima kasih sudah berkomentar! Ini info yang kakak tanyakan:" },
    broadcast_message: {
      text: "Halo kak {{nama}} 👋 ada promo spesial minggu ini! Balas *MAU* untuk info lengkapnya ya.",
      mediaUrl: "",
      template: "",
      language: "",
      headerFormat: "",
      headerUrl: "",
      params: [],
      buttons: [],
      saveAs: "balasan",
    },
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
    case "broadcast_message": {
      const d = node.data as NodeDataMap["broadcast_message"];
      if (!d.buttons.length) return [{ id: "out", label: "Saat dibalas" }];
      return [
        ...d.buttons.map((b) => ({ id: `btn:${b.id}`, label: `🔘 ${b.text}` })),
        { id: "out", label: "Balasan lain", tone: "muted" as const },
      ];
    }
    case "ai_agent":
      // n8n style: answered → continue; needs a human → own branch (default: hand over).
      return [
        { id: "out", label: "Terjawab" },
        { id: "handoff", label: "Perlu CS", tone: "muted" as const },
      ];
    default:
      return [{ id: "out", label: "" }];
  }
}

export function ruleLabel(variable: string, r: ConditionRule): string {
  const op = CONDITION_OPS.find((o) => o.value === r.op);
  const v = variable || "?";
  return op?.needsValue ? `${v} ${op.label} "${r.value}"` : `${v} ${op?.label ?? r.op}`;
}

// --- AI node settings ⇄ engine (snake_case, matches engine AgentSpec) -----------------

export function aiToEngine(raw: unknown): Record<string, unknown> {
  const c = normalizeAiConfig(raw);
  return {
    role: c.role,
    tone: c.tone,
    emoji: c.emoji,
    length: c.length,
    greeting: c.greeting,
    language: c.language,
    goal: c.goal || null,
    instructions: c.instructions || null,
    examples: c.examples.filter((x) => x.q.trim() && x.a.trim()),
    handoff_rules: c.handoffRules || null,
    fallback_message: c.fallbackMessage || null,
    knowledge_all: c.knowledgeAll,
    document_ids: c.knowledgeAll ? [] : c.documentIds,
    use_catalog: c.useCatalog,
    use_promos: c.usePromos,
    business_info: businessToEngine(c.businessInfo),
  };
}

function aiFromEngine(raw: any): AiConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_AI_CONFIG;
  return normalizeAiConfig({
    role: raw.role,
    tone: raw.tone,
    emoji: raw.emoji,
    length: raw.length,
    greeting: raw.greeting,
    language: raw.language,
    goal: raw.goal ?? "",
    instructions: raw.instructions ?? "",
    examples: raw.examples,
    handoffRules: raw.handoff_rules ?? "",
    fallbackMessage: raw.fallback_message ?? "",
    knowledgeAll: raw.knowledge_all ?? true,
    documentIds: raw.document_ids,
    useCatalog: raw.use_catalog ?? true,
    usePromos: raw.use_promos ?? true,
    businessInfo: businessFromEngine(raw.business_info),
  });
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
          trigger: {
            kind: d.kind,
            match: d.kind === "keyword" || d.kind === "button" || d.kind === "comment" ? d.keywords : [],
            ...(d.channels?.length ? { channels: d.channels } : {}),
            ...(d.kind === "comment" && d.posts?.length ? { posts: d.posts } : {}),
            ...(d.kind === "broadcast" ? { tags: d.tags ?? [], schedule_at: d.scheduleAt || null } : {}),
            ...(d.kind === "welcome" && d.idleHours && d.idleHours > 0 ? { idle_hours: Math.round(d.idleHours) } : {}),
          },
          next,
        });
        break;
      }
      case "broadcast_message": {
        const d = node.data as NodeDataMap["broadcast_message"];
        out.push({
          id: node.id,
          type: "broadcast_message",
          text: d.text,
          media_url: d.mediaUrl.trim() || undefined,
          template: d.template
            ? {
                name: d.template,
                lang: d.language,
                header_format: d.headerFormat || undefined,
                header_url: d.headerUrl.trim() || undefined,
                params: d.params.map((p) => ({ source: p.source, value: p.value, fallback: p.fallback })),
              }
            : undefined,
          buttons: d.buttons.map((b) => ({ index: b.index, text: b.text, next: target(node.id, `btn:${b.id}`) })),
          save_as: d.saveAs || "balasan",
          next,
        });
        break;
      }
      case "send_text": {
        const d = node.data as NodeDataMap["send_text"];
        out.push({ id: node.id, type: "send_text", text: d.text, ...variantsOut(d.variants), next });
        break;
      }
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
      case "reply_comment":
        out.push({
          id: node.id,
          type: "reply_comment",
          texts: (node.data as NodeDataMap["reply_comment"]).texts.map((t) => t.trim()).filter(Boolean),
          next,
        });
        break;
      case "private_reply": {
        const d = node.data as NodeDataMap["private_reply"];
        out.push({ id: node.id, type: "private_reply", text: d.text, ...variantsOut(d.variants), next });
        break;
      }
      case "add_tag":
        out.push({ id: node.id, type: "add_tag", tags: (node.data as NodeDataMap["add_tag"]).tags, next });
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
        // Options travel as real WA buttons/list on the Cloud API (id = code, so a tap
        // matches the code alias); other channels get them appended as numbered text.
        out.push({
          id: node.id,
          type: "send_text",
          text: d.prompt,
          buttons: d.options.map((o) => ({ id: o.code.trim(), title: o.label.trim() })),
          next: waitId,
        });
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
      case "ai_agent": {
        const d = node.data as NodeDataMap["ai_agent"];
        const mode = aiNodeMode(d);
        out.push({
          id: node.id,
          type: "ai_agent",
          // Engine order: node settings (ai) → agent_id → channel assistant → default.
          ...(mode === "custom" ? { ai: aiToEngine(d.ai) } : {}),
          ...(mode === "agent" && d.agentId ? { agent_id: d.agentId } : {}),
          next,
          handoff_next: target(node.id, "handoff"),
        });
        break;
      }
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
  const isComment = triggers.some((t) => (t.data as NodeDataMap["trigger"]).kind === "comment");
  const isBroadcast = triggers.some((t) => (t.data as NodeDataMap["trigger"]).kind === "broadcast");
  const firstStep = (t: GraphNode) => graph.nodes.find((n) => n.id === graph.edges.find((e) => e.source === t.id && e.sourceHandle === "out")?.target);

  for (const node of graph.nodes) {
    switch (node.type) {
      case "trigger": {
        const d = node.data as NodeDataMap["trigger"];
        if (d.kind === "keyword" && d.keywords.length === 0) add(node.id, "Tambahkan minimal satu keyword");
        if (d.kind === "button" && d.keywords.length === 0) add(node.id, "Tambahkan label tombol yang memicu flow");
        if (d.kind === "comment" && !graph.nodes.some((n) => n.type === "reply_comment" || n.type === "private_reply"))
          add(node.id, "Flow komentar butuh langkah Balas Komentar atau Kirim DM");
        if (d.kind === "broadcast") {
          if ((d.channels ?? []).length !== 1) add(node.id, "Pilih satu akun WhatsApp pengirim");
          if (hasEdge(node.id, "out") && firstStep(node)?.type !== "broadcast_message")
            add(node.id, "Langkah pertama broadcast harus Pesan Broadcast");
        }
        if (!hasEdge(node.id, "out")) add(node.id, "Sambungkan Pemicu ke langkah pertama");
        break;
      }
      case "broadcast_message": {
        const d = node.data as NodeDataMap["broadcast_message"];
        const trig = triggers[0];
        if (!isBroadcast || !trig || firstStep(trig)?.id !== node.id)
          add(node.id, "Hanya dipakai tepat setelah Pemicu Broadcast");
        if (!d.template && !d.text.trim()) add(node.id, "Isi pesan broadcast atau pilih template");
        if (d.mediaUrl.trim() && !/^(https?:\/\/|\/uploads\/)/.test(d.mediaUrl.trim())) add(node.id, "URL gambar harus diawali https://");
        if (d.template && d.params.some((p) => p.source === "static" && !p.value.trim())) add(node.id, "Isi semua variabel template");
        if (d.template && ["IMAGE", "VIDEO", "DOCUMENT"].includes(d.headerFormat) && !/^https:\/\//.test(d.headerUrl.trim()))
          add(node.id, "Template ini butuh media header (URL https)");
        if (!VAR_RE.test(d.saveAs || "balasan")) add(node.id, "Nama variabel hanya huruf, angka, underscore");
        break;
      }
      case "send_text":
        if (!(node.data as NodeDataMap["send_text"]).text.trim()) add(node.id, "Isi pesan masih kosong");
        break;
      case "send_media":
        if (!/^https?:\/\//.test((node.data as NodeDataMap["send_media"]).url.trim()))
          add(node.id, "URL media harus diawali http(s)://");
        break;
      case "reply_comment":
        if (!(node.data as NodeDataMap["reply_comment"]).texts.some((t) => t.trim())) add(node.id, "Isi minimal satu variasi balasan");
        if (!isComment) add(node.id, "Hanya berfungsi bila Pemicu = Komentar");
        break;
      case "private_reply":
        if (!(node.data as NodeDataMap["private_reply"]).text.trim()) add(node.id, "Isi pesan DM masih kosong");
        if (!isComment) add(node.id, "Hanya berfungsi bila Pemicu = Komentar");
        break;
      case "add_tag":
        if ((node.data as NodeDataMap["add_tag"]).tags.length === 0) add(node.id, "Tambahkan minimal satu tag");
        break;
      case "ai_agent": {
        const d = node.data as NodeDataMap["ai_agent"];
        if (aiNodeMode(d) === "agent" && !d.agentId) add(node.id, "Pilih asisten AI");
        break;
      }
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
    if (n.type === "ai_agent" && !refOk(n.handoff_next)) return `Cabang 'Perlu CS' tidak valid (${n.id})`;
    if (n.type === "broadcast_message") {
      if (!Array.isArray(n.buttons)) return `Tombol broadcast tidak valid (${n.id})`;
      for (const b of n.buttons) if (!Number.isInteger(b?.index) || !refOk(b.next)) return `Cabang tombol tidak valid (${n.id})`;
    }
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
        gNodes.push({
          id: n.id,
          type: "trigger",
          position: at,
          data: {
            kind: n.trigger?.kind ?? "keyword",
            keywords: n.trigger?.match ?? [],
            channels: Array.isArray(n.trigger?.channels) ? n.trigger.channels.map(String) : [],
            posts: Array.isArray(n.trigger?.posts) ? n.trigger.posts.map(String) : [],
            ...(n.trigger?.kind === "broadcast"
              ? { tags: Array.isArray(n.trigger?.tags) ? n.trigger.tags.map(String) : [], scheduleAt: n.trigger?.schedule_at ?? null }
              : {}),
            ...(n.trigger?.kind === "welcome" && Number(n.trigger?.idle_hours) > 0 ? { idleHours: Number(n.trigger.idle_hours) } : {}),
          },
        });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "send_text":
        gNodes.push({ id: n.id, type: "send_text", position: at, data: { text: String(n.text ?? ""), ...variantsIn(n.variants) } });
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
      case "reply_comment":
        gNodes.push({ id: n.id, type: "reply_comment", position: at, data: { texts: Array.isArray(n.texts) ? n.texts.map(String) : [] } });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "private_reply":
        gNodes.push({ id: n.id, type: "private_reply", position: at, data: { text: String(n.text ?? ""), ...variantsIn(n.variants) } });
        edges.push(...edge(n.id, "out", n.next));
        break;
      case "add_tag":
        gNodes.push({ id: n.id, type: "add_tag", position: at, data: { tags: Array.isArray(n.tags) ? n.tags.map(String) : [] } });
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
        gNodes.push({
          id: n.id,
          type: "ai_agent",
          position: at,
          // Same precedence as the engine: own settings → chosen assistant → channel.
          data: n.ai
            ? { ai: aiFromEngine(n.ai), mode: "custom" }
            : n.agent_id
              ? { ai: DEFAULT_AI_CONFIG, mode: "agent", agentId: String(n.agent_id) }
              : { ai: DEFAULT_AI_CONFIG, mode: "channel" },
        });
        edges.push(...edge(n.id, "out", n.next));
        edges.push(...edge(n.id, "handoff", n.handoff_next));
        break;
      case "handoff":
        gNodes.push({ id: n.id, type: "handoff", position: at, data: {} });
        break;
      case "broadcast_message": {
        const buttons: BroadcastButton[] = (Array.isArray(n.buttons) ? n.buttons : []).map((b: any) => ({
          id: newId("b"),
          index: Number(b.index) || 0,
          text: String(b.text ?? ""),
        }));
        gNodes.push({
          id: n.id,
          type: "broadcast_message",
          position: at,
          data: {
            text: String(n.text ?? ""),
            mediaUrl: String(n.media_url ?? ""),
            template: String(n.template?.name ?? ""),
            language: String(n.template?.lang ?? ""),
            headerFormat: String(n.template?.header_format ?? ""),
            headerUrl: String(n.template?.header_url ?? ""),
            params: (Array.isArray(n.template?.params) ? n.template.params : []).map((p: any) => ({
              id: newId("p"),
              source: p.source ?? "static",
              value: String(p.value ?? ""),
              fallback: String(p.fallback ?? ""),
            })),
            buttons,
            saveAs: String(n.save_as ?? "balasan"),
          },
        });
        edges.push(...edge(n.id, "out", n.next));
        buttons.forEach((b, i) => edges.push(...edge(n.id, `btn:${b.id}`, n.buttons[i]?.next)));
        break;
      }
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
    if (n.type === "trigger" && (n.data as NodeDataMap["trigger"]).kind === "comment") {
      vars.add("komentar");
      vars.add("post_id");
    }
    if (n.type === "wait_reply") vars.add((n.data as NodeDataMap["wait_reply"]).saveAs);
    if (n.type === "broadcast_message") {
      vars.add((n.data as NodeDataMap["broadcast_message"]).saveAs || "balasan");
      if ((n.data as NodeDataMap["broadcast_message"]).buttons.length) vars.add("tombol");
    }
    if (n.type === "menu") vars.add((n.data as NodeDataMap["menu"]).saveAs);
    if (n.type === "set_var") (n.data as NodeDataMap["set_var"]).pairs.forEach((p) => p.key.trim() && vars.add(p.key.trim()));
  }
  return [...vars].filter((v) => VAR_RE.test(v));
}

// Message variants ↔ flow definition. Empty wordings are dropped; no variants → no key.
function variantsOut(variants: string[] | undefined): { variants?: string[] } {
  const list = (variants ?? []).map((t) => t.trim()).filter(Boolean);
  return list.length ? { variants: list } : {};
}

function variantsIn(raw: unknown): { variants?: string[] } {
  return Array.isArray(raw) && raw.length ? { variants: raw.map(String) } : {};
}
