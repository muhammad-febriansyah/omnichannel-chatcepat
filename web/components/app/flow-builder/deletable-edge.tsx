"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Connector with a small × in the middle: hover (or select) the line, click × to remove it.
function DeletableEdgeImpl({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, selected }: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={24} />
      <EdgeLabelRenderer>
        <button
          type="button"
          aria-label="Hapus konektor"
          title="Hapus konektor"
          onClick={(e) => {
            e.stopPropagation();
            void deleteElements({ edges: [{ id }] });
          }}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          className={cn(
            "nodrag nopan pointer-events-auto absolute grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition",
            "hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15",
            selected ? "scale-110 opacity-100" : "opacity-70 hover:opacity-100",
          )}
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      </EdgeLabelRenderer>
    </>
  );
}

export const DeletableEdge = memo(DeletableEdgeImpl);
