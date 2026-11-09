"use client";

import { Input } from "@/components/ui/input";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type OnBeforeDelete,
} from "@xyflow/react";
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, PanelLeft, LayoutGrid, MousePointerClick, Maximize2, Pencil, Search, Lock, ChevronDown } from "lucide-react";
import { nodeAllowed } from "@/lib/plan-config";
import { gooeyToast } from "@/components/ui/goey-toaster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveFlow } from "@/lib/actions";
import {
  autoLayout,
  compileGraph,
  defaultData,
  flowVariables,
  loadGraph,
  newId,
  outputHandles,
  validateGraph,
  type FlowGraph,
  type GraphNode,
  type NodeDataMap,
  type NodeKind,
} from "@/lib/flow-graph";
import { FlowNode, type FlowRFNode } from "./flow-node";
import { DeletableEdge } from "./deletable-edge";
import type { FlowTriggerInfo } from "@/lib/flow-conflicts";
import { ConfigPanel, type AgentOption, type ChannelOption } from "./config-panel";
import type { KnowledgeDoc, PromoItem } from "@/lib/ai-agent-options";
import { COMING_SOON, DRAG_MIME, GROUP_FOR_TRIGGER, NODE_META, PALETTE_GROUPS, nodeMatches, type NodeGroup } from "./meta";
import { SaveFlowDialog, type SaveSummary } from "./save-dialog";
import type { BroadcastTemplateOpt } from "@/lib/broadcast-flow";

const nodeTypes = Object.fromEntries(Object.keys(NODE_META).map((k) => [k, FlowNode]));

const edgeTypes = { deletable: DeletableEdge };

const edgeDefaults = {
  type: "deletable",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { strokeWidth: 2 },
};

// Assistant names for AI nodes come from the live list (renames show up, deleted ones don't).
function withAgentNames(n: GraphNode, agents: AgentOption[]): GraphNode["data"] {
  if (n.type !== "ai_agent") return n.data;
  const d = n.data as NodeDataMap["ai_agent"];
  return d.agentId ? { ...d, agentName: agents.find((a) => a.id === d.agentId)?.name } : d;
}

function toRF(graph: FlowGraph, agents: AgentOption[] = []): { nodes: FlowRFNode[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      deletable: n.type !== "trigger",
      data: { kind: n.type, payload: withAgentNames(n, agents), issues: [], disabled: n.disabled || undefined },
    })),
    edges: graph.edges.map((e) => ({ ...edgeDefaults, id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target })),
  };
}

function fromRF(nodes: FlowRFNode[], edges: Edge[]): FlowGraph {
  const gNodes = nodes.map(
    (n) =>
      ({ id: n.id, type: n.data.kind, position: n.position, data: n.data.payload, ...(n.data.disabled ? { disabled: true } : {}) }) as GraphNode,
  );
  // Drop wires whose output vanished (e.g. a removed menu option / template button).
  const handles = new Map(gNodes.map((n) => [n.id, new Set(outputHandles(n).map((h) => h.id))]));
  return {
    nodes: gNodes,
    edges: edges
      .map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle ?? "out", target: e.target }))
      .filter((e) => handles.get(e.source)?.has(e.sourceHandle)),
  };
}

type Props = {
  id: string;
  name: string;
  status: "draft" | "active";
  definition: unknown;
  docs?: KnowledgeDoc[];
  promos?: PromoItem[];
  channels?: ChannelOption[];
  agents?: AgentOption[];
  otherFlows?: FlowTriggerInfo[]; // other ACTIVE flows of this workspace
  allowedNodes?: string[] | null; // null = every step (plan entitlements)
  tags?: string[];
  templates?: BroadcastTemplateOpt[];
};

function Builder({ id, name: initialName, status: initialStatus, definition, docs = [], promos = [], channels = [], agents = [], otherFlows = [], allowedNodes = null, tags = [], templates = [] }: Props) {
  const initial = useMemo(() => toRF(loadGraph(definition), agents), [definition, agents]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowRFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<NodeGroup>>(new Set());
  // The dialog remembers the last choice (activate vs draft); first save defaults to activate.
  const [lastActivate, setLastActivate] = useState(true);
  const chosen = useRef(true);
  const [saveKey, setSaveKey] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const rf = useReactFlow();
  const { resolvedTheme } = useTheme();

  const graph = useMemo(() => fromRF(nodes, edges), [nodes, edges]);
  const variables = useMemo(() => flowVariables(graph), [graph]);
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const markDirty = useCallback(() => setDirty(true), []);

  // After a deploy the open page can't save (stale Server Action ids). The draft is kept
  // in sessionStorage across the reload and restored here, so no work is lost.
  const draftKey = `flow-draft:${id}`;
  const reloading = useRef(false);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(draftKey);
    } catch {
      return;
    }
    if (!raw) return;
    const draftJson = raw;
    // Applied after mount (external storage → state), cancelled on re-run.
    const t = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(draftKey);
        const draft = JSON.parse(draftJson) as { name: string; definition: unknown };
        const restored = toRF(loadGraph(draft.definition), agents);
        setNodes(restored.nodes);
        setEdges(restored.edges);
        setName(draft.name);
        setDirty(true);
        gooeyToast.success("Draf dipulihkan", { description: "Klik Simpan untuk menyimpan perubahan Anda." });
      } catch {
        // Corrupt draft: keep the saved version.
      }
    }, 0);
    return () => window.clearTimeout(t);
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadKeepingDraft = useCallback(() => {
    const compiled = compileGraph(graph);
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ name, definition: { nodes: compiled.nodes, ui: { nodes: graph.nodes, edges: graph.edges } } }),
      );
    } catch {
      // Storage blocked: reload anyway (the user chose to).
    }
    reloading.current = true;
    window.location.reload();
  }, [draftKey, graph, name]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      if (!reloading.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const updatePayload = useCallback(
    (nodeId: string, payload: GraphNode["data"]) => {
      setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, payload, issues: [] } } : n)));
      markDirty();
    },
    [setNodes, markDirty],
  );

  // One connection per output handle: a new edge replaces the old one.
  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      const handle = c.sourceHandle ?? "out";
      setEdges((es) => [
        ...es.filter((e) => !(e.source === c.source && (e.sourceHandle ?? "out") === handle)),
        { ...edgeDefaults, id: newId("e"), source: c.source, sourceHandle: handle, target: c.target },
      ]);
      markDirty();
    },
    [setEdges, markDirty],
  );

  const onBeforeDelete: OnBeforeDelete<FlowRFNode, Edge> = useCallback(async ({ nodes: ns, edges: es }) => {
    const keep = ns.filter((n) => n.data.kind !== "trigger");
    if (keep.length !== ns.length) gooeyToast.error("Pemicu tidak bisa dihapus");
    return { nodes: keep, edges: es };
  }, []);

  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      if (!nodeAllowed(allowedNodes, kind)) {
        gooeyToast.error(`${NODE_META[kind].label} tidak termasuk paket Anda`, { description: "Upgrade paket di menu Tagihan & Paket." });
        return;
      }
      let pos = position;
      if (!pos) {
        const rect = wrapper.current?.getBoundingClientRect();
        const center = rf.screenToFlowPosition({
          x: (rect?.left ?? 0) + (rect?.width ?? 800) / 2,
          y: (rect?.top ?? 0) + (rect?.height ?? 600) / 2,
        });
        pos = { x: center.x - 130, y: center.y - 60 };
        // Shift right until the new card doesn't sit on top of an existing one.
        const overlaps = (p: { x: number; y: number }) =>
          rf.getNodes().some((n) => Math.abs(n.position.x - p.x) < 280 && Math.abs(n.position.y - p.y) < 150);
        for (let i = 0; i < 12 && overlaps(pos); i++) pos = { x: pos.x + 300, y: pos.y };
      }
      const nodeId = newId();
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        { id: nodeId, type: kind, position: pos!, selected: true, data: { kind, payload: defaultData(kind), issues: [] } },
      ]);
      setSelectedId(nodeId);
      markDirty();
    },
    [rf, setNodes, markDirty, allowedNodes],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData(DRAG_MIME) as NodeKind;
      if (!kind || !NODE_META[kind]) return;
      const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(kind, { x: p.x - 130, y: p.y - 30 });
    },
    [rf, addNode],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== nodeId));
      setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedId(null);
      markDirty();
    },
    [setNodes, setEdges, markDirty],
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const src = nodes.find((n) => n.id === nodeId);
      if (!src) return;
      const copyId = newId();
      setNodes((ns) => [
        ...ns.map((n) => ({ ...n, selected: false })),
        {
          ...src,
          id: copyId,
          selected: true,
          position: { x: src.position.x + 40, y: src.position.y + 40 },
          data: { ...src.data, payload: structuredClone(src.data.payload), issues: [] },
        },
      ]);
      setSelectedId(copyId);
      markDirty();
    },
    [nodes, setNodes, markDirty],
  );

  const tidy = useCallback(() => {
    const laid = autoLayout(graph);
    const pos = new Map(laid.nodes.map((n) => [n.id, n.position]));
    setNodes((ns) => ns.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })));
    markDirty();
    requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 300 }));
  }, [graph, setNodes, rf, markDirty]);

  const save = useCallback(() => {
    if (!name.trim()) return gooeyToast.error("Nama flow wajib diisi");
    const issues = validateGraph(graph);
    const byNode = new Map<string, string[]>();
    for (const i of issues) if (i.nodeId) byNode.set(i.nodeId, [...(byNode.get(i.nodeId) ?? []), i.message]);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, issues: [...new Set(byNode.get(n.id) ?? [])] } })));
    if (issues.length) {
      const first = issues[0];
      const where = first.nodeId ? nodes.find((n) => n.id === first.nodeId) : null;
      gooeyToast.error(`${issues.length} masalah perlu diperbaiki`, {
        description: `${where ? NODE_META[where.data.kind].label + ": " : ""}${first.message}`,
      });
      if (first.nodeId) {
        setSelectedId(first.nodeId);
        const n = rf.getNode(first.nodeId);
        if (n) rf.setCenter(n.position.x + 130, n.position.y + 60, { zoom: 1, duration: 300 });
      }
      return;
    }
    setSaveKey((k) => k + 1);
    setConfirmOpen(true);
  }, [name, graph, nodes, rf, setNodes]);

  // Runs inside the save dialog (it shows the loading steps and errors).
  const persist = useCallback(
    async (activate: boolean) => {
      const compiled = compileGraph(graph);
      const next = activate ? "active" : "draft";
      const res = await saveFlow(id, {
        name: name.trim(),
        status: next,
        trigger: compiled.trigger,
        definition: { nodes: compiled.nodes, ui: { nodes: graph.nodes, edges: graph.edges } },
      });
      setStatus(next);
      chosen.current = activate;
      setDirty(false);
      return res;
    },
    [graph, id, name],
  );

  const triggerData = nodes.find((n) => n.data.kind === "trigger")?.data.payload as NodeDataMap["trigger"] | undefined;
  const summary: SaveSummary = useMemo(
    () => ({
      id,
      name: name.trim(),
      trigger: triggerData?.kind ?? "keyword",
      keywords: triggerData?.keywords ?? [],
      channels: triggerData?.channels ?? [],
      posts: triggerData?.posts ?? [],
      tags: triggerData?.tags ?? [],
      scheduleAt: triggerData?.scheduleAt ?? null,
      steps: nodes.filter((n) => n.data.kind !== "trigger").length,
      aiNodes: nodes.filter((n) => n.data.kind === "ai_agent").length,
    }),
    [id, name, triggerData, nodes],
  );

  // Ctrl/Cmd + S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!confirmOpen) save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save, confirmOpen]);

  const issueCount = nodes.reduce((acc, n) => acc + n.data.issues.length, 0);
  const q = paletteQuery.trim().toLowerCase();
  // Steps that fit the current trigger (e.g. comment → Komentar FB/IG) come first.
  const preferred = GROUP_FOR_TRIGGER[triggerData?.kind ?? ""];
  const paletteGroups = PALETTE_GROUPS.map(({ group, hint, kinds }) => ({
    group,
    hint,
    kinds: kinds.filter((k) => nodeMatches(k, q)),
  }))
    .filter((g) => g.kinds.length > 0)
    .sort((a, b) => Number(b.group === preferred) - Number(a.group === preferred));
  const toggleGroup = (g: NodeGroup) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <div className="flex h-full min-h-[560px] flex-col bg-background">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 sm:px-4">
        <Link href="/flows" aria-label="Kembali ke daftar flow" className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="group/name relative flex min-w-0 flex-1 items-center sm:max-w-md">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              markDirty();
            }}
            aria-label="Nama flow"
            placeholder="Nama flow"
            className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-transparent pl-2 pr-8 text-base font-semibold outline-none hover:border-border focus:border-brand-blue focus:bg-background focus:ring-4 focus:ring-brand-blue/10"
          />
          <Pencil className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium sm:inline-flex",
              dirty ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "text-muted-foreground",
            )}
          >
            {dirty ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
            {dirty ? "Belum disimpan" : "Tersimpan"}
          </span>
          <span
            title={status === "active" ? "Flow sedang membalas pelanggan" : "Flow belum dipakai"}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold",
              status === "active"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "border-border text-muted-foreground",
            )}
          >
            <span className={cn("relative flex size-2")}>
              {status === "active" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
              <span className={cn("relative inline-flex size-2 rounded-full", status === "active" ? "bg-emerald-500" : "bg-slate-400")} />
            </span>
            {status === "active" ? "Aktif" : "Draft"}
          </span>
          <Button onClick={save} size="sm" className="h-9 px-4" title="Simpan (Ctrl/⌘ + S)">
            <Save className="size-4" />
            Simpan
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Palette */}
        <aside
          className={cn(
            "z-10 flex w-64 shrink-0 flex-col border-r border-border bg-card transition-[margin] duration-200",
            "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:shadow-xl",
            !paletteOpen && "-ml-64",
          )}
        >
          <div className="space-y-2.5 px-3 pb-2 pt-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Langkah</span>
              <button type="button" aria-label="Sembunyikan palet" onClick={() => setPaletteOpen(false)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                <PanelLeft className="size-4" />
              </button>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Cari langkah… mis. dm, foto, tombol"
                aria-label="Cari langkah"
                className="h-8 w-full pl-8 pr-2 text-[13px]"
              />
            </label>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 pt-1">
            {paletteGroups.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted-foreground">Tidak ada langkah “{paletteQuery}”</p>}
            {paletteGroups.map(({ group, hint, kinds }) => {
              // Searching always shows matches, even inside a collapsed group.
              const open = !!q || !collapsed.has(group);
              return (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={open}
                  className="mb-1 flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-muted/60"
                >
                  <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{group}</span>
                  <span className="text-[10.5px] text-muted-foreground/60">{kinds.length}</span>
                  {group === preferred && !q && (
                    <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Cocok</span>
                  )}
                </button>
                {open && <p className="-mt-0.5 mb-1 px-6 text-[10.5px] text-muted-foreground/70">{hint}</p>}
                {open && (
                <div className="space-y-0.5">
                  {kinds.map((kind) => {
                    const m = NODE_META[kind];
                    const Icon = m.icon;
                    const locked = !nodeAllowed(allowedNodes, kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        draggable={!locked}
                        aria-disabled={locked}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DRAG_MIME, kind);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => addNode(kind)}
                        title={locked ? `${m.label} tidak termasuk paket Anda — upgrade di Tagihan & Paket` : `${m.desc} — klik atau seret ke kanvas`}
                        className={cn(
                          "group/item flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors",
                          locked ? "cursor-not-allowed opacity-50" : "cursor-grab hover:border-border hover:bg-muted/60 active:cursor-grabbing",
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white shadow-sm transition-transform group-hover/item:scale-105" style={{ background: m.color }}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium">{m.label}</span>
                            {m.channels && (
                              <span className="shrink-0 rounded bg-muted px-1 py-px text-[9.5px] font-semibold text-muted-foreground" title={`Hanya untuk ${m.channels.join(", ")}`}>
                                {m.channels.join(" · ")}
                              </span>
                            )}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">{locked ? "Butuh paket lebih tinggi" : m.desc}</span>
                        </span>
                        {locked && <Lock className="ml-auto size-3.5 shrink-0 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
              );
            })}
            {!q && (
              <div>
                <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">Segera hadir</div>
                {COMING_SOON.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 opacity-50">
                    <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-[13px] font-medium">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <MousePointerClick className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Seret langkah ke kanvas, lalu tarik titik bulat untuk menyambungkan. Hapus langkah lewat ikon tempat sampah, konektor lewat tombol ×.{" "}
              <Link href="/flows?tab=panduan" target="_blank" className="font-medium text-brand-blue hover:underline">
                Lihat panduan
              </Link>
            </span>
          </div>
        </aside>

        {/* Canvas */}
        <div ref={wrapper} className="relative min-w-0 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <ReactFlow<FlowRFNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={(c) => {
              onNodesChange(c);
              if (c.some((x) => x.type !== "select" && x.type !== "dimensions")) markDirty();
            }}
            onEdgesChange={(c) => {
              onEdgesChange(c);
              if (c.some((x) => x.type === "remove")) markDirty();
            }}
            onConnect={onConnect}
            onBeforeDelete={onBeforeDelete}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            onNodesDelete={(ns) => ns.some((n) => n.id === selectedId) && setSelectedId(null)}
            defaultEdgeOptions={edgeDefaults}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
            snapToGrid
            snapGrid={[20, 20]}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.25}
            maxZoom={1.75}
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
            className="!bg-muted/30"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
            <Controls showInteractive={false} className="!rounded-lg !border !border-border !shadow-sm" />
            <MiniMap
              pannable
              zoomable
              className="!rounded-lg !border !border-border max-md:!hidden"
              nodeColor={(n) => NODE_META[(n as FlowRFNode).data.kind]?.color ?? "#94a3b8"}
              nodeStrokeWidth={0}
              nodeBorderRadius={6}
            />
          </ReactFlow>

          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
            <div className="pointer-events-auto flex items-center rounded-xl border border-border bg-card p-0.5 shadow-sm">
              {!paletteOpen && (
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setPaletteOpen(true)}>
                  <PanelLeft className="size-3.5" /> Langkah
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={tidy}>
                <LayoutGrid className="size-3.5" /> Rapikan
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => rf.fitView({ padding: 0.25, maxZoom: 1, duration: 300 })}>
                <Maximize2 className="size-3.5" /> Pas layar
              </Button>
            </div>
            {issueCount > 0 && (
              <span className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="size-3.5" /> {issueCount} masalah
              </span>
            )}
          </div>
        </div>

        {/* Config panel */}
        {selected && (
          <aside
            className={cn(
              "z-10 shrink-0 border-l border-border bg-card max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:shadow-xl max-sm:w-full",
              selected.data.kind === "ai_agent" ? "w-[400px]" : "w-[340px]",
            )}
          >
            <ConfigPanel
              key={selected.id}
              node={{ id: selected.id, type: selected.data.kind, position: selected.position, data: selected.data.payload } as GraphNode}
              issues={selected.data.issues}
              variables={variables}
              docs={docs}
              promos={promos}
              channels={channels}
              otherFlows={otherFlows}
              tags={tags}
              templates={templates}
              broadcastChannelId={triggerData?.kind === "broadcast" ? (triggerData.channels?.[0] ?? null) : null}
              onChange={(payload) => updatePayload(selected.id, payload)}
              onDelete={() => deleteNode(selected.id)}
              onDuplicate={() => duplicateNode(selected.id)}
              disabled={!!selected.data.disabled}
              onToggleDisabled={() => {
                setNodes((ns) =>
                  ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, disabled: !n.data.disabled || undefined } } : n)),
                );
                markDirty();
              }}
              onClose={() => setSelectedId(null)}
            />
          </aside>
        )}
      </div>

      <SaveFlowDialog
        key={saveKey}
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          // Applied on close so the open dialog isn't reset mid-save.
          if (!o) setLastActivate(chosen.current);
        }}
        summary={summary}
        initialActivate={lastActivate}
        onSave={persist}
        onReload={reloadKeepingDraft}
      />
    </div>
  );
}

export function FlowBuilder(props: Props) {
  return (
    <ReactFlowProvider>
      <Builder {...props} />
    </ReactFlowProvider>
  );
}
