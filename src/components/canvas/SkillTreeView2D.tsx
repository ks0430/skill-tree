"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import dagre from "dagre";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";

// Node dimensions fed into dagre
const NODE_W = 160;
const NODE_H = 60;
const PHASE_NODE_W_BASE = 160;
const PHASE_NODE_H_BASE = 64;
const RANK_SEP = 100; // vertical gap between dependency levels
const NODE_SEP = 80;  // horizontal gap between sibling nodes (increased for breathing room)

interface PositionedNode {
  id: string;
  node: Node3D;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PositionedEdge {
  id: string;
  type: string;
  isPhaseEdge: boolean;
  isCompletedPhase: boolean;
  isActivePhase: boolean;
  points: { x: number; y: number }[];
}

const VIRTUAL_ROOT_ID = "__ROOT__";

interface PhaseStats {
  total: number;
  done: number;
  status: "completed" | "in_progress" | "backlog";
}

function computePhaseStats(
  phaseId: string,
  allNodes: Node3D[]
): PhaseStats {
  const children = allNodes.filter(
    (n) => n.data.parent_id === phaseId
  );
  const total = children.length;
  const done = children.filter((n) => ((n.data.properties?.status as string) ?? "backlog") === "completed").length;
  const hasInProgress = children.some((n) => ((n.data.properties?.status as string) ?? "backlog") === "in_progress");
  let status: "completed" | "in_progress" | "backlog" = "backlog";
  if (total > 0 && done === total) status = "completed";
  else if (done > 0 || hasInProgress) status = "in_progress";
  return { total, done, status };
}

/** Size a phase node proportional to ticket count (clamped). */
function phaseNodeSize(total: number): { w: number; h: number } {
  const scale = Math.min(1.8, Math.max(1, 1 + total * 0.04));
  return {
    w: Math.round(PHASE_NODE_W_BASE * scale),
    h: Math.round(PHASE_NODE_H_BASE * scale),
  };
}

/** Small deterministic x-offset per sibling to break perfect columns. */
function organicOffset(id: string, index: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  // Shift alternating left/right, capped at ±18px
  const sign = index % 2 === 0 ? 1 : -1;
  return sign * ((hash % 15) + 3);
}

function buildDagreLayout(
  nodes: Node3D[],
  edges: { source_id: string; target_id: string; type: string; id: string }[],
  expandedPhaseIds: Set<string>,
  allNodes: Node3D[]
): { posNodes: PositionedNode[]; posEdges: PositionedEdge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "BT", // bottom-to-top: root at bottom, phases branch upward
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Precompute phase stats
  const phaseStats = new Map<string, PhaseStats>();
  nodes.forEach((n) => {
    const type = n.data.type;
    if (type === "stellar") {
      phaseStats.set(n.id, computePhaseStats(n.id, allNodes));
    }
  });

  // Add virtual ROOT node (hidden — zero size)
  g.setNode(VIRTUAL_ROOT_ID, { width: 0, height: 0 });

  // Determine which nodes are visible:
  // Level 1: stellar (phase) nodes only
  // Level 2: if a phase is expanded, also show its planet children
  const visibleNodes = nodes.filter((n) => {
    const type = n.data.type;
    if (type === "stellar") return true;
    if (type === "planet") {
      // Show if parent phase is expanded
      return n.data.parent_id && expandedPhaseIds.has(n.data.parent_id);
    }
    // satellites not shown in this view
    return false;
  });

  const nodeIds = new Set(visibleNodes.map((n) => n.id));
  const nodeSizeMap = new Map<string, { w: number; h: number }>();

  // Add all visible nodes with appropriate sizes
  visibleNodes.forEach((n, idx) => {
    const type = n.data.type;
    if (type === "stellar") {
      const stats = phaseStats.get(n.id) ?? { total: 0, done: 0, status: "backlog" as const };
      const { w, h } = phaseNodeSize(stats.total);
      nodeSizeMap.set(n.id, { w, h });
      g.setNode(n.id, { width: w, height: h });
    } else {
      nodeSizeMap.set(n.id, { w: NODE_W, h: NODE_H });
      g.setNode(n.id, { width: NODE_W, height: NODE_H });
    }
  });

  // Build edges: phase nodes → ROOT, planet nodes → phase node
  visibleNodes.forEach((n, idx) => {
    const type = n.data.type;
    if (type === "stellar") {
      // Phase → ROOT (BT: ROOT at bottom, phases above)
      g.setEdge(VIRTUAL_ROOT_ID, n.id, { id: `${VIRTUAL_ROOT_ID}-${n.id}`, isPhaseEdge: true });
    } else if (type === "planet" && n.data.parent_id && nodeIds.has(n.data.parent_id)) {
      // Planet → Phase
      g.setEdge(n.data.parent_id, n.id, { id: `${n.data.parent_id}-${n.id}`, isPhaseEdge: false });
    }
  });

  dagre.layout(g);

  // Extract positioned nodes (exclude ROOT)
  const posNodes: PositionedNode[] = visibleNodes.map((n, idx) => {
    const pos = g.node(n.id);
    const { w, h } = nodeSizeMap.get(n.id) ?? { w: NODE_W, h: NODE_H };
    const type = n.data.type;
    // Apply organic x-offset only to phase (stellar) nodes
    const xOff = type === "stellar" ? organicOffset(n.id, idx) : 0;
    return {
      id: n.id,
      node: n,
      x: pos.x - w / 2 + xOff,
      y: pos.y - h / 2,
      w,
      h,
    };
  });

  // Extract positioned edges (exclude edges to/from ROOT)
  const posEdges: PositionedEdge[] = g.edges()
    .filter((e) => e.v !== VIRTUAL_ROOT_ID && e.w !== VIRTUAL_ROOT_ID)
    .map((e) => {
      const edgeObj = g.edge(e);
      const edgeId = edgeObj.id ?? `${e.v}-${e.w}`;
      const sourceNode = visibleNodes.find((n) => n.id === e.v);
      const targetNode = visibleNodes.find((n) => n.id === e.w);
      const isPhaseEdge =
        (sourceNode?.data.type) === "stellar" &&
        (targetNode?.data.type) === "planet";
      const phaseId = isPhaseEdge ? e.v : e.w;
      const stats = phaseStats.get(phaseId);
      return {
        id: edgeId,
        type: "parent",
        isPhaseEdge,
        isCompletedPhase: stats?.status === "completed",
        isActivePhase: stats?.status === "in_progress",
        points: edgeObj.points ?? [],
      };
    });

  const graphInfo = g.graph() as { width?: number; height?: number };
  const width = (graphInfo.width ?? 400) + 80;
  const height = (graphInfo.height ?? 300) + 80;

  return { posNodes, posEdges, width, height };
}

function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  const parts = [`M ${first.x} ${first.y}`];
  for (let i = 0; i < rest.length - 1; i++) {
    const p1 = rest[i];
    const p2 = rest[i + 1];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    parts.push(`Q ${p1.x} ${p1.y} ${mx} ${my}`);
  }
  const last = rest[rest.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(" ");
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#34d399",  // green
  in_progress: "#f59e0b", // amber
  backlog: "#334155",      // dark slate
  queued: "#60a5fa",      // blue
};

const PHASE_GLOW: Record<string, string> = {
  completed: "0 0 18px 4px rgba(52,211,153,0.55)",
  in_progress: "0 0 16px 3px rgba(245,158,11,0.5)",
  backlog: "none",
};

const PHASE_BORDER: Record<string, string> = {
  completed: "#34d399",
  in_progress: "#f59e0b",
  backlog: "#334155",
};

export function SkillTreeView2D() {
  const nodes = useTreeStore((s) => s.nodes);
  const edges = useTreeStore((s) => s.edges);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);

  // Two-level view: which phase nodes are expanded (showing their planets)
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Set<string>>(new Set());

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 40, scale: 1 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Build dagre layout
  const { posNodes, posEdges, svgWidth, svgHeight } = useMemo(() => {
    const { posNodes, posEdges, width, height } = buildDagreLayout(nodes, edges, expandedPhaseIds, nodes);
    return { posNodes, posEdges, svgWidth: Math.max(width, 400), svgHeight: Math.max(height, 300) };
  }, [nodes, edges, expandedPhaseIds]);

  const pinnedNode = useMemo(() => nodes.find((n) => n.id === pinnedNodeId), [nodes, pinnedNodeId]);

  // Fit-to-screen handler
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / svgWidth;
    const scaleY = rect.height / svgHeight;
    const scale = Math.min(scaleX, scaleY, 1) * 0.9;
    const x = (rect.width - svgWidth * scale) / 2;
    const y = (rect.height - svgHeight * scale) / 2;
    setTransform({ x, y, scale });
  }, [svgWidth, svgHeight]);

  // Pointer events for panning
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    isPanning.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((t) => {
      const newScale = Math.min(2.5, Math.max(0.2, t.scale * factor));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: newScale };
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newX = mx - (mx - t.x) * (newScale / t.scale);
      const newY = my - (my - t.y) * (newScale / t.scale);
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  // Handle phase node click: toggle expansion
  const handleNodeClick = useCallback((node: Node3D, nodeId: string) => {
    const type = node.data.type;
    if (type === "stellar") {
      setExpandedPhaseIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
    } else {
      setPinnedNode(pinnedNodeId === nodeId ? null : nodeId);
    }
  }, [pinnedNodeId, setPinnedNode]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ background: "#0a0e1a", cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      {/* CSS animations for pulsing amber edge */}
      <style>{`
        @keyframes pulse-amber {
          0%, 100% { stroke-opacity: 0.9; stroke-width: 2.5px; }
          50% { stroke-opacity: 0.4; stroke-width: 1.5px; }
        }
        .edge-active-phase {
          animation: pulse-amber 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* SVG layer for edges */}
      <svg
        ref={svgRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {posEdges.map((edge) => {
            const d = pointsToPath(edge.points);
            if (!d) return null;
            const stroke = edge.isCompletedPhase
              ? "#34d399"
              : edge.isActivePhase
              ? "#f59e0b"
              : "rgba(100,116,139,0.5)";
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={edge.isCompletedPhase ? 2.5 : edge.isActivePhase ? 2.5 : 1.5}
                className={edge.isActivePhase ? "edge-active-phase" : undefined}
              />
            );
          })}
        </g>
      </svg>

      {/* Node layer */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
          width: svgWidth,
          height: svgHeight,
        }}
      >
        {posNodes.map(({ id, node, x, y, w, h }) => {
          const type = node.data.type;
          const status = (node.data.properties?.status as string) ?? "backlog";
          const isHighlighted = id === searchHighlightId;
          const isPinned = id === pinnedNodeId;
          const isHovered = id === hoveredNodeId;
          const isExpanded = expandedPhaseIds.has(id);
          const isPhase = type === "stellar";

          if (isPhase) {
            // Compute phase stats for display
            const stats: PhaseStats = (() => {
              const children = nodes.filter((n) => n.data.parent_id === id);
              const total = children.length;
              const done = children.filter((n) => ((n.data.properties?.status as string) ?? "backlog") === "completed").length;
              const hasInProgress = children.some((n) => ((n.data.properties?.status as string) ?? "backlog") === "in_progress");
              let st: "completed" | "in_progress" | "backlog" = "backlog";
              if (total > 0 && done === total) st = "completed";
              else if (done > 0 || hasInProgress) st = "in_progress";
              return { total, done, status: st };
            })();

            const borderColor = isHighlighted
              ? "#f59e0b"
              : PHASE_BORDER[stats.status] ?? "#334155";
            const glow = isHovered
              ? "0 0 20px 5px rgba(129,140,248,0.6)"
              : PHASE_GLOW[stats.status] ?? "none";
            const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
            const phaseName = node.data.label;

            return (
              <div
                key={id}
                data-node="true"
                onClick={() => handleNodeClick(node, id)}
                onMouseEnter={() => setHoveredNodeId(id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  borderRadius: 12,
                  border: `2px solid ${borderColor}`,
                  background: isHovered
                    ? "rgba(30,41,59,0.95)"
                    : stats.status === "completed"
                    ? "rgba(15,35,30,0.92)"
                    : stats.status === "in_progress"
                    ? "rgba(30,25,15,0.92)"
                    : "rgba(10,14,26,0.92)",
                  boxShadow: glow,
                  cursor: "pointer",
                  userSelect: "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "8px 12px",
                  gap: 4,
                  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                }}
              >
                {/* Phase label */}
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: stats.status === "completed"
                      ? "#34d399"
                      : stats.status === "in_progress"
                      ? "#f59e0b"
                      : "#94a3b8",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={phaseName}
                >
                  {phaseName}
                </div>
                {/* Stats row */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "monospace",
                      color: "#64748b",
                    }}
                  >
                    {stats.done}/{stats.total} done
                  </span>
                  {/* Completion bar */}
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      background: "rgba(71,85,105,0.4)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${completionPct}%`,
                        borderRadius: 2,
                        background: stats.status === "completed"
                          ? "#34d399"
                          : stats.status === "in_progress"
                          ? "#f59e0b"
                          : "#334155",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  {/* Expand indicator */}
                  <span
                    style={{
                      fontSize: 9,
                      color: "#475569",
                      transform: isExpanded ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                      display: "inline-block",
                    }}
                  >
                    ▲
                  </span>
                </div>
              </div>
            );
          }

          // Planet (ticket) node
          return (
            <div
              key={id}
              data-node="true"
              onClick={() => handleNodeClick(node, id)}
              onMouseEnter={() => setHoveredNodeId(id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                height: h,
                borderRadius: 8,
                border: isHovered
                  ? "2px solid #a5b4fc"
                  : isPinned
                  ? "2px solid #818cf8"
                  : `1.5px solid ${STATUS_COLORS[status] ?? "#475569"}`,
                background: isHovered
                  ? "rgba(99,102,241,0.28)"
                  : isPinned
                  ? "rgba(99,102,241,0.18)"
                  : status === "backlog"
                  ? "rgba(10,14,26,0.75)"
                  : "rgba(15,22,41,0.85)",
                boxShadow: isHighlighted
                  ? "0 0 0 3px #f59e0b"
                  : isHovered
                  ? "0 0 10px rgba(129,140,248,0.6)"
                  : isPinned
                  ? "0 0 0 2px rgba(129,140,248,0.5)"
                  : undefined,
                cursor: "pointer",
                userSelect: "none",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "6px 10px",
                gap: 3,
                transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
                opacity: status === "backlog" ? 0.55 : 1,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: 600,
                  color: "#e2e8f0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={node.data.label}
              >
                {node.data.label}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: STATUS_COLORS[status] ?? "#475569",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "monospace",
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fit-to-screen button */}
      <button
        onClick={fitToScreen}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "rgba(15,22,41,0.85)",
          border: "1px solid #334155",
          borderRadius: 6,
          color: "#94a3b8",
          fontSize: 11,
          fontFamily: "monospace",
          padding: "5px 10px",
          cursor: "pointer",
          zIndex: 10,
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#818cf8";
          (e.currentTarget as HTMLButtonElement).style.color = "#a5b4fc";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#334155";
          (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
        }}
        title="Fit all phases to screen"
      >
        ⊞ Fit
      </button>

      {/* Reuse detail panel and search from solar view */}
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
        Click phase to expand · Click ticket to pin details · Drag to pan · Scroll to zoom · / to search
      </div>
    </div>
  );
}
