"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { outputHandles, type GraphNode, type NodeDataMap, type NodeKind } from "@/lib/flow-graph";
import { NODE_META } from "./meta";

export type FlowNodeData = { kind: NodeKind; payload: GraphNode["data"]; issues: string[] };
export type FlowRFNode = Node<FlowNodeData>;

// One readable line describing what the node does.
function summary(kind: NodeKind, payload: GraphNode["data"]): string {
  switch (kind) {
    case "trigger": {
      const d = payload as NodeDataMap["trigger"];
      if (d.kind === "welcome") return "Pesan pertama dari pelanggan";
      if (d.kind === "fallback") return "Pesan yang tidak cocok flow lain";
      return d.keywords.length ? "" : "Belum ada keyword";
    }
    case "send_text":
      return (payload as NodeDataMap["send_text"]).text.split("\n").find((l) => l.trim()) ?? "Pesan kosong";
    case "send_media": {
      const d = payload as NodeDataMap["send_media"];
      return d.caption || d.url || "URL media belum diisi";
    }
    case "send_catalog": {
      const d = payload as NodeDataMap["send_catalog"];
      return d.category ? `Kategori: ${d.category}` : "Semua produk aktif";
    }
    case "menu":
      return (payload as NodeDataMap["menu"]).prompt.split("\n")[0] || "Pesan menu kosong";
    case "wait_reply":
      return `Simpan ke {{${(payload as NodeDataMap["wait_reply"]).saveAs || "?"}}}`;
    case "condition":
      return `Cek {{${(payload as NodeDataMap["condition"]).variable || "?"}}}`;
    case "set_var": {
      const keys = (payload as NodeDataMap["set_var"]).pairs.map((p) => p.key).filter(Boolean);
      return keys.length ? keys.map((k) => `{{${k}}}`).join(", ") : "Belum ada variabel";
    }
    case "ai_agent":
      return "Jawab dari knowledge base & katalog";
    case "handoff":
      return "Percakapan diteruskan ke CS";
  }
}

function FlowNodeImpl({ id, data, selected }: NodeProps<FlowRFNode>) {
  const meta = NODE_META[data.kind];
  const Icon = meta.icon;
  const handles = outputHandles({ id, type: data.kind, position: { x: 0, y: 0 }, data: data.payload } as GraphNode);
  const branching = handles.length > 1 || (handles[0] && handles[0].label);
  const hasIssue = data.issues.length > 0;
  const keywords = data.kind === "trigger" ? (data.payload as NodeDataMap["trigger"]).keywords : [];
  const isKeyword = data.kind === "trigger" && (data.payload as NodeDataMap["trigger"]).kind === "keyword";
  const text = summary(data.kind, data.payload);

  return (
    <div
      className={cn(
        "group w-[260px] rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow",
        selected ? "border-brand-blue shadow-[0_0_0_3px_rgba(59,130,246,0.18)]" : "border-border hover:shadow-md",
        hasIssue && !selected && "border-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.18)] dark:border-red-500/70",
      )}
    >
      {data.kind !== "trigger" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!size-3 !border-2 !border-card !bg-muted-foreground/60"
        />
      )}

      <div className="flex items-center gap-2.5 px-3 pt-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white shadow-sm"
          style={{ background: meta.color }}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight">{meta.label}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{meta.group}</div>
        </div>
        {hasIssue && (
          <span title={data.issues.join("\n")} className="text-red-500">
            <AlertCircle className="size-4" />
          </span>
        )}
      </div>

      <div className="px-3 pb-3 pt-2">
        {isKeyword && keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 6).map((k) => (
              <span key={k} className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {k}
              </span>
            ))}
            {keywords.length > 6 && <span className="text-[11px] text-muted-foreground">+{keywords.length - 6}</span>}
          </div>
        ) : (
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{text}</p>
        )}
        {hasIssue && <p className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">{data.issues[0]}</p>}
      </div>

      {branching ? (
        <div className="space-y-1 border-t border-border px-3 py-2">
          {handles.map((h) => (
            <div key={h.id} className="relative flex items-center justify-end">
              <span
                className={cn(
                  "max-w-[220px] truncate rounded-md px-1.5 py-0.5 text-[11px]",
                  h.tone === "muted" ? "text-muted-foreground" : "bg-muted font-medium text-foreground",
                )}
              >
                {h.label}
              </span>
              <Handle
                type="source"
                id={h.id}
                position={Position.Right}
                className="!-right-[13px] !size-3 !border-2 !border-card"
                style={{ background: h.tone === "muted" ? "var(--muted-foreground)" : meta.color }}
              />
            </div>
          ))}
        </div>
      ) : (
        handles.map((h) => (
          <Handle
            key={h.id}
            type="source"
            id={h.id}
            position={Position.Bottom}
            className="!size-3 !border-2 !border-card"
            style={{ background: meta.color }}
          />
        ))
      )}
    </div>
  );
}

export const FlowNode = memo(FlowNodeImpl);
