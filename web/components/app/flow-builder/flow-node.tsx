"use client";

import { memo } from "react";
import { Handle, Position, useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { AlertCircle, Power, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { aiNodeMode, outputHandles, type GraphNode, type NodeDataMap, type NodeKind } from "@/lib/flow-graph";
import { normalizeAiConfig, roleLabel, toneMeta } from "@/lib/ai-agent-options";
import { NODE_META } from "./meta";
import { formatWib } from "@/lib/broadcast-flow";

export type FlowNodeData = { kind: NodeKind; payload: GraphNode["data"]; issues: string[]; disabled?: boolean };
export type FlowRFNode = Node<FlowNodeData>;

// One readable line describing what the node does.
function summary(kind: NodeKind, payload: GraphNode["data"]): string {
  switch (kind) {
    case "trigger": {
      const d = payload as NodeDataMap["trigger"];
      if (d.kind === "welcome")
        return d.idleHours ? `Pesan pertama / kembali setelah ${d.idleHours} jam` : "Pesan pertama dari pelanggan";
      if (d.kind === "fallback") return "Pesan yang tidak cocok flow lain";
      if (d.kind === "button") return d.keywords.length ? "" : "Belum ada label tombol";
      if (d.kind === "comment") return d.keywords.length ? "" : "Semua komentar FB/IG";
      if (d.kind === "broadcast") {
        const who = d.tags?.length ? `Tag: ${d.tags.join(", ")}` : "Semua kontak opt-in";
        const when = d.scheduleAt ? formatWib(d.scheduleAt) : "segera saat diaktifkan";
        return `${who} · ${when}`;
      }
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
    case "add_tag": {
      const tags = (payload as NodeDataMap["add_tag"]).tags;
      return tags.length ? "" : "Belum ada tag";
    }
    case "ai_agent":
    {
      const d = payload as NodeDataMap["ai_agent"];
      const mode = aiNodeMode(d);
      if (mode === "channel") return "Asisten default";
      if (mode === "agent") return d.agentId ? `Asisten: ${d.agentName || "terpilih"}` : "Belum pilih asisten";
      const ai = normalizeAiConfig(d?.ai);
      const t = toneMeta(ai.tone);
      return `${t.emoji} ${t.label} · ${roleLabel(ai.role)}`;
    }
    case "handoff":
      return "Percakapan diteruskan ke CS";
    case "reply_comment": {
      const texts = (payload as NodeDataMap["reply_comment"]).texts.filter((t) => t.trim());
      return texts.length ? `${texts[0]}${texts.length > 1 ? ` (+${texts.length - 1} variasi)` : ""}` : "Balasan kosong";
    }
    case "private_reply":
      return (payload as NodeDataMap["private_reply"]).text.split("\n").find((l) => l.trim()) ?? "DM kosong";
    case "broadcast_message": {
      const d = payload as NodeDataMap["broadcast_message"];
      if (d.template) return `Template: ${d.template}`;
      return d.text.split("\n").find((l) => l.trim()) ?? "Pesan kosong";
    }
  }
}

function FlowNodeImpl({ id, data, selected }: NodeProps<FlowRFNode>) {
  const meta = NODE_META[data.kind];
  const Icon = meta.icon;
  const { deleteElements, updateNodeData } = useReactFlow();
  const off = data.kind !== "trigger" && !!data.disabled;
  const handles = outputHandles({ id, type: data.kind, position: { x: 0, y: 0 }, data: data.payload } as GraphNode);
  const branching = handles.length > 1 || (handles[0] && handles[0].label);
  const hasIssue = data.issues.length > 0;
  const trig = data.kind === "trigger" ? (data.payload as NodeDataMap["trigger"]) : null;
  const keywords = trig ? trig.keywords : data.kind === "add_tag" ? (data.payload as NodeDataMap["add_tag"]).tags : [];
  const isKeyword = (trig !== null && (trig.kind === "keyword" || trig.kind === "button" || trig.kind === "comment")) || data.kind === "add_tag";
  const chipCls =
    data.kind === "add_tag"
      ? "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300"
      : trig?.kind === "button"
        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300"
        : trig?.kind === "comment"
          ? "bg-pink-100 text-pink-800 dark:bg-pink-500/15 dark:text-pink-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  const text = summary(data.kind, data.payload);

  return (
    <div
      className={cn(
        "group w-[260px] rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow",
        off && "border-dashed opacity-60 grayscale",
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
        {data.kind !== "trigger" && (
          // Turned off: skipped at runtime, the flow continues at its next step.
          <button
            type="button"
            aria-label={off ? `Aktifkan langkah ${meta.label}` : `Nonaktifkan langkah ${meta.label}`}
            aria-pressed={off}
            title={off ? "Aktifkan langkah" : "Nonaktifkan langkah (dilewati)"}
            onClick={(e) => {
              e.stopPropagation();
              updateNodeData(id, { disabled: !off });
            }}
            className={cn(
              "nodrag nopan grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground",
              off || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              off && "text-amber-600",
            )}
          >
            <Power className="size-3.5" />
          </button>
        )}
        {data.kind !== "trigger" && (
          // Removes the step and every connector attached to it.
          <button
            type="button"
            aria-label={`Hapus langkah ${meta.label}`}
            title="Hapus langkah"
            onClick={(e) => {
              e.stopPropagation();
              void deleteElements({ nodes: [{ id }] });
            }}
            className={cn(
              "nodrag nopan grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15",
              selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="px-3 pb-3 pt-2">
        {off && (
          <span className="mb-1.5 inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            Nonaktif · dilewati
          </span>
        )}
        {isKeyword && keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 6).map((k) => (
              <span key={k} className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", chipCls)}>
                {trig?.kind === "button" ? "🔘 " : trig?.kind === "comment" ? "💬 " : data.kind === "add_tag" ? "#" : ""}
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
