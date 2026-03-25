"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import dagre from "dagre";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";

// Node dimensions fed into dagre
const NODE_W = 140;
const NODE_H = 52;
const RANK_SEP = 90; // vertical gap between dependency levels
const NODE_SEP = 50; // horizontal gap between sibling nodes

interface PositionedNode {
  id: string;
  node: Node3D;
  x: number;
  y: number;
}

interface PositionedEdge {
  id: string;
  points: { x: number; y: number }[];
}

const VIRTUAL_ROOT_ID = "__ROOT__";

function buildDagreLayout(
  nodes: Node3D[],
  edges: { source_id: string; target_id: string; type: string; id: string }[]
): { posNodes: PositionedNode[]; posEdges: PositionedEdge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB", // top-to-bottom dependency flow
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add virtual ROOT node (hidden — zero size so dagre treats it as a layout anchor)
  g.setNode(VIRTUAL_ROOT_ID, { width: 0, height: 0 });

  // Add all real nodes
  nodes.forEach((n) => {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
  });

  // Prefer depends_on edges; fall back to parent_id edges when none exist
  const depEdges = edges.filter((e) => e.type === "depends_on");
  const nodeIds = new Set(nodes.map((n) => n.id));

  if (depEdges.length > 0) {
    // Use dependency edges: source depends on target → target is a prerequisite → target ranks above source
    depEdges.forEach((e) => {
      if (nodeIds.has(e.source_id) && nodeIds.has(e.target_id)) {
        // Edge direction: prerequisite → dependent (target → source in depends_on semantics)
        g.setEdge(e.target_id, e.source_id, { id: e.id });
      }
    });
    // Connect stellars (nodes with no incoming dep-edge) to ROOT
    const hasIncoming = new Set(depEdges.map((e) => e.source_id));
    nodes.forEach((n) => {
      if ((n.data.type ?? n.data.role) === "stellar" && !hasIncoming.has(n.id)) {
        g.setEdge(VIRTUAL_ROOT_ID, n.id, { id: `${VIRTUAL_ROOT_ID}-${n.id}` });
      }
    });
  } else {
    // Fallback: use parent_id hierarchy as edges
    nodes.forEach((n) => {
      const parentId = n.data.parent_id;
      if (parentId && nodeIds.has(parentId)) {
        g.setEdge(parentId, n.id, { id: `${parentId}-${n.id}` });
      }
    });
    // Connect all phase stellars (no parent_id) to ROOT
    nodes.forEach((n) => {
      if ((n.data.type ?? n.data.role) === "stellar" && !n.data.parent_id) {
        g.setEdge(VIRTUAL_ROOT_ID, n.id, { id: `${VIRTUAL_ROOT_ID}-${n.id}` });
      }
    });
  }

  dagre.layout(g);

  // Exclude virtual ROOT from rendered nodes
  const posNodes: PositionedNode[] = nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      node: n,
      // dagre returns center coordinates; convert to top-left
      x: pos.x - NODE_W / 2,
      y: pos.y - NODE_H / 2,
    };
  });

  // Exclude edges connected to ROOT from rendered edges
  const posEdges: PositionedEdge[] = g.edges()
    .filter((e) => e.v !== VIRTUAL_ROOT_ID && e.w !== VIRTUAL_ROOT_ID)
    .map((e) => {
      const edgeObj = g.edge(e);
      const edgeId = edgeObj.id ?? `${e.v}-${e.w}`;
      return {
        id: edgeId,
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
    const p0 = i === 0 ? first : rest[i - 1];
    const p1 = rest[i];
    const p2 = rest[i + 1];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    void p0;
    parts.push(`L ${p1.x} ${p1.y}`);
    void mx; void my;
  }
  const last = rest[rest.length - 1];
  parts.push(`L ${last.x} ${last.y}`);
  return parts.join(" ");
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#22d3ee",
  in_progress: "#f59e0b",
  locked: "#475569",
};

const TYPE_BORDER: Record<string, string> = {
  stellar: "#818cf8",
  planet: "#34d399",
  satellite: "#94a3b8",
};

export function SkillTreeView2D() {
  const nodes = useTreeStore((s) => s.nodes);
  const edges = useTreeStore((s) => s.edges);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 40, scale: 1 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Build dagre layout from dependency edges
  const { posNodes, posEdges, svgWidth, svgHeight } = useMemo(() => {
    const { posNodes, posEdges, width, height } = buildDagreLayout(nodes, edges);
    return { posNodes, posEdges, svgWidth: Math.max(width, 400), svgHeight: Math.max(height, 300) };
  }, [nodes, edges]);

  const pinnedNode = useMemo(() => nodes.find((n) => n.id === pinnedNodeId), [nodes, pinnedNodeId]);

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
      const newScale = Math.min(2.5, Math.max(0.25, t.scale * factor));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: newScale };
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newX = mx - (mx - t.x) * (newScale / t.scale);
      const newY = my - (my - t.y) * (newScale / t.scale);
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

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
      {/* SVG layer for edges */}
      <svg
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
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="rgba(148,163,184,0.4)" />
          </marker>
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {posEdges.map((edge) => {
            const d = pointsToPath(edge.points);
            if (!d) return null;
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke="rgba(148,163,184,0.3)"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
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
        {posNodes.map(({ id, node, x, y }) => {
          const type = node.data.type ?? node.data.role;
          const status = node.data.status;
          const isHighlighted = id === searchHighlightId;
          const isPinned = id === pinnedNodeId;

          return (
            <div
              key={id}
              data-node="true"
              onClick={() => setPinnedNode(isPinned ? null : id)}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: NODE_W,
                height: NODE_H,
                borderRadius: 8,
                border: `1.5px solid ${isPinned ? "#818cf8" : TYPE_BORDER[type] ?? "#475569"}`,
                background: isPinned
                  ? "rgba(99,102,241,0.18)"
                  : "rgba(15,22,41,0.85)",
                boxShadow: isHighlighted
                  ? "0 0 0 3px #f59e0b"
                  : isPinned
                  ? "0 0 0 2px rgba(129,140,248,0.5)"
                  : "none",
                cursor: "pointer",
                userSelect: "none",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                padding: "6px 10px",
                gap: 3,
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}
            >
              {/* Label */}
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
              {/* Status + type badges */}
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
                  {type}
                </span>
              </div>
            </div>
          );
        })}
      </div>

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
        Click node to pin details · Drag to pan · Scroll to zoom · / to search
      </div>
    </div>
  );
}
