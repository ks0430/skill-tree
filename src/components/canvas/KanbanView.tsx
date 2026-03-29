"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { sfxDragStart, sfxDrop } from "@/lib/sfx";
import { useTreeStore } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";
import { FilterBar } from "./FilterBar";
import { createClient } from "@/lib/supabase/client";
import type { Node3D } from "@/lib/store/tree-store";
import type { SkillNode, TreeSchema, ViewConfig } from "@/types/skill-tree";
import { getNodeProperty, DEFAULT_SCHEMA, isCardType, getTypeLabel } from "@/types/skill-tree";

type Filter = NonNullable<ViewConfig["filters"]>[number];

function applyFilters(node: Node3D, filters: Filter[]): boolean {
  for (const f of filters) {
    const val = getNodeProperty(node.data, f.property);
    if (f.operator === "in") {
      const arr = Array.isArray(f.value) ? (f.value as string[]) : [];
      if (arr.length > 0 && !arr.includes(String(val ?? ""))) return false;
    } else if (f.operator === "contains") {
      const q = String(f.value ?? "").toLowerCase();
      if (q && !String(val ?? "").toLowerCase().includes(q)) return false;
    } else if (f.operator === "between") {
      const range = f.value as { from?: string; to?: string };
      const v = String(val ?? "");
      if (range.from && v < range.from) return false;
      if (range.to && v > range.to) return false;
    }
  }
  return true;
}

// ── Dynamic column config builder ──────────────────────────────────────────

const PALETTE = [
  { headerColor: "#475569", borderColor: "rgba(71,85,105,0.4)",  badgeColor: "rgba(71,85,105,0.35)" },
  { headerColor: "#8b5cf6", borderColor: "rgba(139,92,246,0.4)", badgeColor: "rgba(139,92,246,0.2)" },
  { headerColor: "#f59e0b", borderColor: "rgba(245,158,11,0.4)", badgeColor: "rgba(245,158,11,0.2)" },
  { headerColor: "#22d3ee", borderColor: "rgba(34,211,238,0.4)", badgeColor: "rgba(34,211,238,0.15)" },
  { headerColor: "#34d399", borderColor: "rgba(52,211,153,0.4)", badgeColor: "rgba(52,211,153,0.2)" },
  { headerColor: "#f87171", borderColor: "rgba(248,113,113,0.4)", badgeColor: "rgba(248,113,113,0.2)" },
  { headerColor: "#a78bfa", borderColor: "rgba(167,139,250,0.4)", badgeColor: "rgba(167,139,250,0.2)" },
  { headerColor: "#fb923c", borderColor: "rgba(251,146,60,0.4)",  badgeColor: "rgba(251,146,60,0.2)" },
];

interface ColumnConfig {
  id: string;
  label: string;
  headerColor: string;
  borderColor: string;
  badgeColor: string;
}

function buildColumnConfigs(schema: TreeSchema, groupBy: string): ColumnConfig[] {
  const prop = schema.properties[groupBy];
  const options = prop?.options ?? [];
  return options.map((opt, i) => {
    const pal = PALETTE[i % PALETTE.length];
    return {
      id: opt,
      label: opt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      ...pal,
    };
  });
}

const TYPE_COLORS: Record<string, string> = {
  stellar: "#818cf8",
  planet: "#34d399",
  satellite: "#94a3b8",
};

interface DragState {
  nodeId: string;
  fromColumn: string;
  fromIndex: number;
}

export function KanbanView({ schema, viewConfig }: { schema?: TreeSchema; viewConfig?: ViewConfig }) {
  const groupBy = viewConfig?.group_by ?? "status";
  const resolvedSchema = schema ?? DEFAULT_SCHEMA;
  const columnConfigs = useMemo(() => buildColumnConfigs(resolvedSchema, groupBy), [resolvedSchema, groupBy]);
  const nodes = useTreeStore((s) => s.nodes);
  const updateNode = useTreeStore((s) => s.updateNode);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);
  const treeId = useTreeStore((s) => s.treeId);

  const addNode = useTreeStore((s) => s.addNode);
  const removeNode = useTreeStore((s) => s.removeNode);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    column: string;
    index: number;
  } | null>(null);
  // Track recently updated node IDs for flash animation
  const [flashNodeIds, setFlashNodeIds] = useState<Set<string>>(new Set());
  // Realtime connection state
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const supabase = createClient();

  // Polling fallback: re-fetch all nodes every 8s to catch updates
  // when Supabase Realtime isn't delivering (table not in publication).
  useEffect(() => {
    if (!treeId) return;
    let active = true;

    async function pollNodes() {
      const { data, error } = await supabase
        .from("skill_nodes")
        .select("id, icon, properties, label, description, type")
        .eq("tree_id", treeId!);
      if (!active || error || !data) return;

      for (const row of data) {
        const { id: nodeId, ...rest } = row;
        updateNode(nodeId, rest as Partial<SkillNode>);
      }
    }

    const interval = setInterval(pollNodes, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [treeId]);

  // Supabase Realtime subscription for live board updates
  useEffect(() => {
    if (!treeId) return;

    const channel = supabase
      .channel(`kanban:skill_nodes:${treeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "skill_nodes",
          filter: `tree_id=eq.${treeId}`,
        },
        (payload) => {
          const newNode = payload.new as SkillNode;
          if (newNode?.id) {
            addNode({ ...newNode, content: newNode.content ?? { blocks: [] } });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "skill_nodes",
          filter: `tree_id=eq.${treeId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<SkillNode> & { id?: string };
          if (updated?.id) {
            const { id: nodeId, ...rest } = updated;
            updateNode(nodeId, rest);
            // Flash the updated card
            setFlashNodeIds((prev) => {
              const next = new Set(prev);
              next.add(nodeId);
              return next;
            });
            setTimeout(() => {
              setFlashNodeIds((prev) => {
                const next = new Set(prev);
                next.delete(nodeId);
                return next;
              });
            }, 1200);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "skill_nodes",
          filter: `tree_id=eq.${treeId}`,
        },
        (payload) => {
          const deleted = payload.old as { id?: string };
          if (deleted?.id) {
            removeNode(deleted.id);
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setRealtimeConnected(false);
    };
  }, [treeId]);

  const [filters, setFilters] = useState<Filter[]>(viewConfig?.filters ?? []);
  const [donePageSize, setDonePageSize] = useState<number>(20); // paginate done column in All mode

  // Group nodes into columns dynamically based on schema group_by property
  // lastColTotal tracks the full count of the last column before pagination
  const columnIds = useMemo(() => columnConfigs.map((c) => c.id), [columnConfigs]);
  const lastColId = columnIds[columnIds.length - 1];

  const [columns, lastColTotal] = useMemo(() => {
    const grouped: Record<string, Node3D[]> = {};
    for (const colId of columnIds) grouped[colId] = [];

    // Deduplicate by node id
    const seen = new Map<string, Node3D>();
    for (const node of nodes) seen.set(node.id, node);

    for (const node of seen.values()) {
      const nodeType = node.data.type;
      // Skip stellar (phase) nodes — only show planets (tickets)
      if (!isCardType(resolvedSchema, nodeType)) continue;
      // Apply schema-based filters
      if (!applyFilters(node, filters)) continue;
      const val = String(getNodeProperty(node.data, groupBy) ?? columnIds[0] ?? "");
      const col = columnIds.includes(val) ? val : columnIds[0];
      if (grouped[col]) grouped[col].push(node);
    }

    // Sort all columns by priority ascending (lowest = next to run)
    for (const colId of columnIds) {
      grouped[colId].sort((a, b) => ((a.data.properties?.priority as number) ?? 3) - ((b.data.properties?.priority as number) ?? 3));
    }

    // Sort completed column by completed_at descending (most recent first)
    const completedColId = columnIds[columnIds.length - 1];
    if (completedColId) {
      grouped[completedColId].sort((a, b) => {
        const aTime = (a.data.properties?.completed_at as string) ?? "";
        const bTime = (b.data.properties?.completed_at as string) ?? "";
        return bTime.localeCompare(aTime);
      });
    }

    // Paginate last column to avoid rendering too many cards
    const totalLast = lastColId ? grouped[lastColId]?.length ?? 0 : 0;
    if (lastColId && grouped[lastColId]) {
      grouped[lastColId] = grouped[lastColId].slice(0, donePageSize);
    }

    return [grouped, totalLast] as const;
  }, [nodes, filters, donePageSize, columnIds, groupBy, lastColId]);

  const pinnedNode = useMemo(
    () => nodes.find((n) => n.id === pinnedNodeId),
    [nodes, pinnedNodeId]
  );

  // Persist property + priority update to Supabase
  const persistUpdate = useCallback(
    async (nodeId: string, columnValue: string, priority: number) => {
      if (!treeId) return;
      const node = nodes.find((n) => n.id === nodeId);
      const mergedProps = { ...(node?.data.properties ?? {}), [groupBy]: columnValue };
      const mergedWithPriority = { ...mergedProps, priority };
      const update: Partial<SkillNode> = { properties: mergedWithPriority };
      updateNode(nodeId, update);
      await supabase
        .from("skill_nodes")
        .update(update)
        .eq("id", nodeId)
        .eq("tree_id", treeId);
    },
    [treeId, updateNode, supabase, nodes, groupBy]
  );

  // ── Delete handler ─────────────────────────────────────────────────────────

  const deleteNode = useCallback(
    async (nodeId: string) => {
      if (!treeId) return;
      removeNode(nodeId);
      await supabase
        .from("skill_nodes")
        .delete()
        .eq("id", nodeId)
        .eq("tree_id", treeId);
      setConfirmDeleteId(null);
    },
    [treeId, removeNode, supabase]
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const onDragStart = useCallback(
    (e: React.DragEvent, node: Node3D, column: string, index: number) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", node.id);
      setDragState({ nodeId: node.id, fromColumn: column, fromIndex: index });
      sfxDragStart();
    },
    []
  );

  const onDragOver = useCallback(
    (e: React.DragEvent, column: string, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget({ column, index });
    },
    []
  );

  const onDragOverColumn = useCallback(
    (e: React.DragEvent, column: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      // Only update if no specific card target
      setDropTarget((prev) => {
        if (prev?.column === column) return prev;
        return { column, index: (columns[column] ?? []).length };
      });
    },
    [columns]
  );

  const onDrop = useCallback(
    (e: React.DragEvent, targetColumn: string, targetIndex: number) => {
      e.preventDefault();
      if (!dragState) return;

      const { nodeId } = dragState;
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) return;

      const colNodes = (columns[targetColumn] ?? []).filter((n) => n.id !== nodeId);

      // Compute new priority: insert at targetIndex in sorted-desc list
      // Priority range: higher = higher in list
      let newPriority: number;
      if (colNodes.length === 0) {
        newPriority = 5;
      } else if (targetIndex <= 0) {
        // Above everything — one more than the highest
        newPriority = (((colNodes[0]?.data.properties?.priority as number) ?? 5) ?? 5) + 1;
      } else if (targetIndex >= colNodes.length) {
        // Below everything — one less than the lowest
        newPriority = Math.max(0, ((colNodes[colNodes.length - 1]?.data.properties?.priority as number) ?? 1) - 1);
      } else {
        // Between two cards — midpoint
        const above = (colNodes[targetIndex - 1]?.data.properties?.priority as number) ?? 5;
        const below = (colNodes[targetIndex]?.data.properties?.priority as number) ?? 0;
        newPriority = (above + below) / 2;
      }

      persistUpdate(nodeId, targetColumn, newPriority);
      sfxDrop();
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
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 shrink-0">
        {/* Realtime live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 4 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: realtimeConnected ? "#22c55e" : "#475569",
              boxShadow: realtimeConnected ? "0 0 6px #22c55e" : "none",
              transition: "background 0.3s, box-shadow 0.3s",
            }}
          />
          <span style={{
            fontFamily: "monospace", fontSize: 9, color: realtimeConnected ? "#22c55e" : "#475569",
            textTransform: "uppercase", letterSpacing: "0.08em",
            transition: "color 0.3s",
          }}>
            {realtimeConnected ? "live" : "connecting…"}
          </span>
        </div>
        {/* FilterBar */}
        <FilterBar schema={resolvedSchema} filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Column layout */}
      <div
        className="flex gap-4 p-4 pt-2 h-full overflow-x-auto overflow-y-hidden"
        style={{ alignItems: "stretch" }}
      >
        {columnConfigs.map((col) => {
          const colNodes = columns[col.id] ?? [];
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
                <span style={{ fontSize: 14, width: 8, height: 8, borderRadius: "50%", background: col.headerColor, display: "inline-block" }} />
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
                  {col.id === lastColId ? lastColTotal : colNodes.length}
                </div>
              </div>

              {/* Cards scroll area */}
              <div
                className="flex-1 overflow-y-auto rounded-b flex flex-col gap-2 p-2"
                style={{
                  background: isDragTarget
                    ? `${col.headerColor}08`
                    : "rgba(255,255,255,0.02)",
                  borderTop: "none",
                  borderRight: `1px solid ${isDragTarget ? col.headerColor + "60" : col.borderColor}`,
                  borderBottom: `1px solid ${isDragTarget ? col.headerColor + "60" : col.borderColor}`,
                  borderLeft: `1px solid ${isDragTarget ? col.headerColor + "60" : col.borderColor}`,
                  transition: "background 0.15s, border-color 0.15s",
                  minHeight: 80,
                  contain: "strict",
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
                  const type = node.data.type;
                  const typeColor = TYPE_COLORS[type] ?? "#475569";
                  const isPinned = node.id === pinnedNodeId;
                  const isBeingDragged = dragState?.nodeId === node.id;
                  const isFlashing = flashNodeIds.has(node.id);
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
                        onMouseEnter={() => setHoverCardId(node.id)}
                        onMouseLeave={() => setHoverCardId(null)}
                        onClick={() => setPinnedNode(isPinned ? null : node.id)}
                        style={{
                          background: isFlashing
                            ? "rgba(34,197,94,0.12)"
                            : isPinned
                            ? "rgba(99,102,241,0.15)"
                            : "rgba(255,255,255,0.03)",
                          borderTop: `1px solid ${isFlashing ? "#22c55e" : isPinned ? "#818cf8" : node.id === searchHighlightId ? "#f59e0b" : "rgba(148,163,184,0.1)"}`,
                          borderRight: `1px solid ${isFlashing ? "#22c55e" : isPinned ? "#818cf8" : node.id === searchHighlightId ? "#f59e0b" : "rgba(148,163,184,0.1)"}`,
                          borderBottom: `1px solid ${isFlashing ? "#22c55e" : isPinned ? "#818cf8" : node.id === searchHighlightId ? "#f59e0b" : "rgba(148,163,184,0.1)"}`,
                          borderLeft: `3px solid ${isFlashing ? "#22c55e" : typeColor}`,
                          borderRadius: 6,
                          padding: "10px 12px",
                          cursor: "grab",
                          opacity: isBeingDragged ? 0.4 : 1,
                          transition: "opacity 0.15s, border-color 0.3s, background 0.3s",
                          boxShadow: isFlashing
                            ? "0 0 0 1px rgba(34,197,94,0.4)"
                            : node.id === searchHighlightId
                            ? "0 0 0 2px #f59e0b"
                            : isPinned
                            ? "0 0 0 1px rgba(129,140,248,0.4)"
                            : "none",
                        }}
                      >
                        {/* NEXT badge + priority + delete for first column */}
                        {col.id === columnIds[0] && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            {index === 0 && (
                              <span style={{
                                fontFamily: "monospace", fontSize: 9, fontWeight: 800,
                                background: "#22c55e22", color: "#22c55e",
                                border: "1px solid #22c55e66",
                                borderRadius: 3, padding: "1px 5px", letterSpacing: "0.08em"
                              }}>▶ NEXT</span>
                            )}
                            <span style={{
                              fontFamily: "monospace", fontSize: 9, color: "#64748b",
                              marginLeft: "auto"
                            }}>priority {(node.data.properties?.priority as number) ?? 3}</span>
                            {/* Delete button — visible on hover */}
                            {hoverCardId === node.id && confirmDeleteId !== node.id && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(node.id); }}
                                title="Delete ticket"
                                style={{
                                  background: "transparent", border: "none", cursor: "pointer",
                                  padding: "2px 3px", color: "#475569", lineHeight: 1,
                                  borderRadius: 3, transition: "color 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6M14 11v6" />
                                  <path d="M9 6V4h6v2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Inline delete confirmation */}
                        {col.id === columnIds[0] && confirmDeleteId === node.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              marginBottom: 6, padding: "6px 8px", borderRadius: 4,
                              background: "rgba(239,68,68,0.08)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              display: "flex", alignItems: "center", gap: 8,
                            }}
                          >
                            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#f87171", flex: 1 }}>
                              Delete this ticket?
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                              style={{
                                fontFamily: "monospace", fontSize: 9, fontWeight: 700,
                                background: "rgba(239,68,68,0.2)", color: "#f87171",
                                border: "1px solid rgba(239,68,68,0.4)",
                                borderRadius: 3, padding: "2px 7px", cursor: "pointer",
                              }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              style={{
                                fontFamily: "monospace", fontSize: 9,
                                background: "transparent", color: "#64748b",
                                border: "1px solid rgba(100,116,139,0.3)",
                                borderRadius: 3, padding: "2px 7px", cursor: "pointer",
                              }}
                            >
                              No
                            </button>
                          </div>
                        )}

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
                            p{(() => { const p = (node.data.properties?.priority as number) ?? 3; return typeof p === "number" && p.toFixed ? p.toFixed(1) : p; })()}
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

                {/* Load more button — last column */}
                {col.id === lastColId && lastColTotal > donePageSize && (
                  <button
                    onClick={() => setDonePageSize((s) => s + 20)}
                    style={{
                      marginTop: 4, width: "100%", padding: "7px 0",
                      fontFamily: "monospace", fontSize: 10,
                      background: "rgba(34,211,238,0.05)",
                      border: "1px solid rgba(34,211,238,0.2)",
                      borderRadius: 4, color: "#22d3ee", cursor: "pointer",
                      letterSpacing: "0.06em", transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.05)")}
                  >
                    Load more +20 ({lastColTotal - donePageSize} remaining)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned node detail panel */}
      {pinnedNode && (
        <NodeDetailPanel
          key={pinnedNode.id}
          node={pinnedNode}
          pinned
          onClose={() => setPinnedNode(null)}
        />
      )}
      {/* SearchPanel hidden on board — board has its own search bar */}
      {/* <SearchPanel /> */}

      {/* Hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Drag cards to reprioritise · Click to pin details · / to search · Updates live
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
