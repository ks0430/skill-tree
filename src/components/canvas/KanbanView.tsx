"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useTreeStore } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";
import { createClient } from "@/lib/supabase/client";
import type { Node3D } from "@/lib/store/tree-store";
import type { NodeStatus } from "@/types/skill-tree";

// Map NodeStatus to Kanban column
const STATUS_COLUMN: Record<NodeStatus, "backlog" | "active" | "done"> = {
  locked: "backlog",
  in_progress: "active",
  completed: "done",
};

const COLUMN_TO_STATUS: Record<"backlog" | "active" | "done", NodeStatus> = {
  backlog: "locked",
  active: "in_progress",
  done: "completed",
};

const COLUMN_CONFIG: {
  id: "backlog" | "active" | "done";
  label: string;
  emoji: string;
  headerColor: string;
  borderColor: string;
  badgeColor: string;
}[] = [
  {
    id: "backlog",
    label: "Backlog",
    emoji: "📋",
    headerColor: "#475569",
    borderColor: "rgba(71,85,105,0.4)",
    badgeColor: "rgba(71,85,105,0.35)",
  },
  {
    id: "active",
    label: "Active",
    emoji: "⚡",
    headerColor: "#f59e0b",
    borderColor: "rgba(245,158,11,0.4)",
    badgeColor: "rgba(245,158,11,0.2)",
  },
  {
    id: "done",
    label: "Done",
    emoji: "✅",
    headerColor: "#22d3ee",
    borderColor: "rgba(34,211,238,0.4)",
    badgeColor: "rgba(34,211,238,0.15)",
  },
];

const TYPE_COLORS: Record<string, string> = {
  stellar: "#818cf8",
  planet: "#34d399",
  satellite: "#94a3b8",
};

interface DragState {
  nodeId: string;
  fromColumn: "backlog" | "active" | "done";
  fromIndex: number;
}

export function KanbanView() {
  const nodes = useTreeStore((s) => s.nodes);
  const updateNode = useTreeStore((s) => s.updateNode);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);
  const treeId = useTreeStore((s) => s.treeId);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    column: "backlog" | "active" | "done";
    index: number;
  } | null>(null);

  const supabase = createClient();

  // Group nodes into columns, sorted by priority desc
  const columns = useMemo(() => {
    const grouped: Record<"backlog" | "active" | "done", Node3D[]> = {
      backlog: [],
      active: [],
      done: [],
    };

    for (const node of nodes) {
      const col = STATUS_COLUMN[node.data.status] ?? "backlog";
      grouped[col].push(node);
    }

    // Sort each column by priority descending
    for (const col of ["backlog", "active", "done"] as const) {
      grouped[col].sort((a, b) => b.data.priority - a.data.priority);
    }

    return grouped;
  }, [nodes]);

  const pinnedNode = useMemo(
    () => nodes.find((n) => n.id === pinnedNodeId),
    [nodes, pinnedNodeId]
  );

  // Persist status + priority update to Supabase
  const persistUpdate = useCallback(
    async (nodeId: string, status: NodeStatus, priority: number) => {
      if (!treeId) return;
      updateNode(nodeId, { status, priority });
      await supabase
        .from("skill_nodes")
        .update({ status, priority })
        .eq("id", nodeId)
        .eq("tree_id", treeId);
    },
    [treeId, updateNode, supabase]
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const onDragStart = useCallback(
    (e: React.DragEvent, node: Node3D, column: "backlog" | "active" | "done", index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", node.id);
      setDragState({ nodeId: node.id, fromColumn: column, fromIndex: index });
    },
    []
  );

  const onDragOver = useCallback(
    (e: React.DragEvent, column: "backlog" | "active" | "done", index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget({ column, index });
    },
    []
  );

  const onDragOverColumn = useCallback(
    (e: React.DragEvent, column: "backlog" | "active" | "done") => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      // Only update if no specific card target
      setDropTarget((prev) => {
        if (prev?.column === column) return prev;
        return { column, index: columns[column].length };
      });
    },
    [columns]
  );

  const onDrop = useCallback(
    (e: React.DragEvent, targetColumn: "backlog" | "active" | "done", targetIndex: number) => {
      e.preventDefault();
      if (!dragState) return;

      const { nodeId, fromColumn } = dragState;
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) return;

      const targetStatus = COLUMN_TO_STATUS[targetColumn];
      const colNodes = columns[targetColumn].filter((n) => n.id !== nodeId);

      // Compute new priority: insert at targetIndex in sorted-desc list
      // Priority range: higher = higher in list
      let newPriority: number;
      if (colNodes.length === 0) {
        newPriority = 5;
      } else if (targetIndex <= 0) {
        // Above everything — one more than the highest
        newPriority = (colNodes[0]?.data.priority ?? 5) + 1;
      } else if (targetIndex >= colNodes.length) {
        // Below everything — one less than the lowest
        newPriority = Math.max(0, (colNodes[colNodes.length - 1]?.data.priority ?? 1) - 1);
      } else {
        // Between two cards — midpoint
        const above = colNodes[targetIndex - 1]?.data.priority ?? 5;
        const below = colNodes[targetIndex]?.data.priority ?? 0;
        newPriority = (above + below) / 2;
      }

      persistUpdate(nodeId, targetStatus, newPriority);
      setDragState(null);
      setDropTarget(null);
    },
    [dragState, nodes, columns, persistUpdate]
  );

  const onDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
  }, []);

  return (
    <div
      className="w-full h-full relative overflow-hidden select-none"
      style={{ background: "#0a0e1a" }}
    >
      {/* Column layout */}
      <div
        className="flex gap-4 p-4 h-full overflow-x-auto overflow-y-hidden"
        style={{ alignItems: "stretch" }}
      >
        {COLUMN_CONFIG.map((col) => {
          const colNodes = columns[col.id];
          const isDragTarget = dropTarget?.column === col.id;

          return (
            <div
              key={col.id}
              className="flex flex-col shrink-0"
              style={{
                width: 280,
                minHeight: 0,
              }}
              onDragOver={(e) => onDragOverColumn(e, col.id)}
              onDrop={(e) => onDrop(e, col.id, columns[col.id].length)}
            >
              {/* Column header */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-t mb-2"
                style={{
                  background: `${col.headerColor}18`,
                  borderTop: `2px solid ${col.headerColor}`,
                  borderLeft: `1px solid ${col.borderColor}`,
                  borderRight: `1px solid ${col.borderColor}`,
                }}
              >
                <span style={{ fontSize: 14 }}>{col.emoji}</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    color: col.headerColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {col.label}
                </span>
                <div
                  className="ml-auto rounded-full px-2 py-0.5"
                  style={{
                    background: col.badgeColor,
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: col.headerColor,
                    fontWeight: 700,
                  }}
                >
                  {colNodes.length}
                </div>
              </div>

              {/* Cards scroll area */}
              <div
                className="flex-1 overflow-y-auto rounded-b flex flex-col gap-2 p-2"
                style={{
                  background: isDragTarget
                    ? `${col.headerColor}08`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isDragTarget ? col.headerColor + "60" : col.borderColor}`,
                  borderTop: "none",
                  transition: "background 0.15s, border-color 0.15s",
                  minHeight: 80,
                }}
              >
                {colNodes.length === 0 && (
                  <div
                    className="flex items-center justify-center py-8"
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "#334155",
                    }}
                  >
                    Drop here
                  </div>
                )}

                {colNodes.map((node, index) => {
                  const type = node.data.type ?? node.data.role;
                  const typeColor = TYPE_COLORS[type] ?? "#475569";
                  const isPinned = node.id === pinnedNodeId;
                  const isBeingDragged = dragState?.nodeId === node.id;
                  const isDropIndicator =
                    dropTarget?.column === col.id && dropTarget.index === index;

                  return (
                    <div key={node.id}>
                      {/* Drop indicator line above this card */}
                      {isDropIndicator && dragState?.nodeId !== node.id && (
                        <div
                          style={{
                            height: 2,
                            borderRadius: 1,
                            background: col.headerColor,
                            marginBottom: 4,
                            boxShadow: `0 0 6px ${col.headerColor}`,
                          }}
                        />
                      )}

                      {/* Card */}
                      <div
                        draggable
                        onDragStart={(e) => onDragStart(e, node, col.id, index)}
                        onDragOver={(e) => {
                          e.stopPropagation();
                          onDragOver(e, col.id, index);
                        }}
                        onDrop={(e) => {
                          e.stopPropagation();
                          onDrop(e, col.id, index);
                        }}
                        onDragEnd={onDragEnd}
                        onClick={() => setPinnedNode(isPinned ? null : node.id)}
                        style={{
                          background: isPinned
                            ? "rgba(99,102,241,0.15)"
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${
                            isPinned
                              ? "#818cf8"
                              : node.id === searchHighlightId
                              ? "#f59e0b"
                              : "rgba(148,163,184,0.1)"
                          }`,
                          borderLeft: `3px solid ${typeColor}`,
                          borderRadius: 6,
                          padding: "10px 12px",
                          cursor: "grab",
                          opacity: isBeingDragged ? 0.4 : 1,
                          transition: "opacity 0.15s, border-color 0.15s, background 0.15s",
                          boxShadow:
                            node.id === searchHighlightId
                              ? "0 0 0 2px #f59e0b"
                              : isPinned
                              ? "0 0 0 1px rgba(129,140,248,0.4)"
                              : "none",
                        }}
                      >
                        {/* Node label */}
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#e2e8f0",
                            marginBottom: 4,
                            lineHeight: 1.4,
                          }}
                        >
                          {node.data.label}
                        </div>

                        {/* Meta row */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              color: typeColor,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {type}
                          </span>
                          <span style={{ color: "#334155", fontSize: 9 }}>·</span>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 9,
                              color: "#475569",
                            }}
                          >
                            p{node.data.priority.toFixed ? node.data.priority.toFixed(1) : node.data.priority}
                          </span>
                          {node.data.icon && (
                            <>
                              <span style={{ color: "#334155", fontSize: 9 }}>·</span>
                              <span style={{ fontSize: 11 }}>{node.data.icon}</span>
                            </>
                          )}
                        </div>

                        {/* Description snippet */}
                        {node.data.description && (
                          <div
                            style={{
                              fontFamily: "monospace",
                              fontSize: 10,
                              color: "#64748b",
                              marginTop: 6,
                              lineHeight: 1.4,
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {node.data.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Drop indicator at end of column */}
                {dropTarget?.column === col.id &&
                  dropTarget.index >= colNodes.length &&
                  dragState &&
                  dragState.nodeId !== colNodes[colNodes.length - 1]?.id && (
                    <div
                      style={{
                        height: 2,
                        borderRadius: 1,
                        background: col.headerColor,
                        boxShadow: `0 0 6px ${col.headerColor}`,
                        marginTop: 2,
                      }}
                    />
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned node detail panel */}
      {pinnedNode && (
        <NodeDetailPanel
          node={pinnedNode}
          pinned
          onClose={() => setPinnedNode(null)}
        />
      )}
      <SearchPanel />

      {/* Hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Drag cards to reprioritise · Click to pin details · / to search
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-slate-600">
            <div className="text-2xl mb-2">📋</div>
            <div className="font-mono text-sm">No nodes yet</div>
            <div className="font-mono text-xs mt-1 text-slate-700">
              Add nodes via the AI assistant to populate the board
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
