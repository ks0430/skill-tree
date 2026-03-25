"use client";

/**
 * World Map view — RPG-style top-down skill dependency map.
 *
 * Layout:   dependency graph top-to-bottom via dagre
 * Locked:   dark/desaturated nodes with fog-of-war texture overlay
 * Active:   amber pulsing glow
 * Completed: green glowing halo
 *
 * Visually styled as a parchment fantasy map: terrain colours per node type,
 * landmark circles, dotted path connectors, compass rose decoration.
 */

import { useMemo, useState, useRef, useCallback } from "react";
import dagre from "dagre";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";

// ─── Layout constants ───────────────────────────────────────────────────────

const NODE_R: Record<string, number> = {
  stellar: 36,
  planet: 24,
  satellite: 16,
};
const DEFAULT_R = 18;

// Dagre works with bounding boxes — use diameter
const NODE_W = (type: string) => (NODE_R[type] ?? DEFAULT_R) * 2 + 12;
const NODE_H = (type: string) => (NODE_R[type] ?? DEFAULT_R) * 2 + 12;

const RANK_SEP = 110;
const NODE_SEP = 70;

const VIRTUAL_ROOT_ID = "__MAP_ROOT__";

// ─── Terrain colours ────────────────────────────────────────────────────────

/** Fill colour per (type × status) — warm earthy tones for the map aesthetic. */
function terrainFill(type: string, status: string): string {
  if (status === "locked") return "#1a1a2e";      // void / fog
  if (status === "completed") {
    if (type === "stellar") return "#14523a";
    if (type === "planet") return "#1a4d35";
    return "#1e5e3e";
  }
  if (status === "in_progress") {
    if (type === "stellar") return "#4a2a05";
    if (type === "planet") return "#3d2204";
    return "#3a2108";
  }
  // default (unlocked, not started — treat as available)
  if (type === "stellar") return "#1e2a45";
  if (type === "planet") return "#18243c";
  return "#141e33";
}

/** Stroke / border colour per status */
function terrainStroke(status: string): string {
  if (status === "locked") return "#2a2a3e";
  if (status === "completed") return "#34d399";
  if (status === "in_progress") return "#f59e0b";
  return "#4a6080";
}

/** Glow filter id per status */
function glowFilterId(status: string): string | undefined {
  if (status === "completed") return "url(#wm-glow-green)";
  if (status === "in_progress") return "url(#wm-glow-amber)";
  return undefined;
}

// ─── Dagre layout ───────────────────────────────────────────────────────────

interface PosNode {
  id: string;
  node: Node3D;
  cx: number;
  cy: number;
  r: number;
}

interface PosEdge {
  id: string;
  type: string;
  points: { x: number; y: number }[];
}

function buildLayout(
  nodes: Node3D[],
  edges: { source_id: string; target_id: string; type: string; id: string }[]
): { posNodes: PosNode[]; posEdges: PosEdge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 60,
    marginy: 60,
  });
  g.setDefaultEdgeLabel(() => ({}));

  g.setNode(VIRTUAL_ROOT_ID, { width: 0, height: 0 });

  nodes.forEach((n) => {
    const type = n.data.type ?? n.data.role;
    g.setNode(n.id, { width: NODE_W(type), height: NODE_H(type) });
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const depEdges = edges.filter((e) => e.type === "depends_on");
  const blocksEdges = edges.filter((e) => e.type === "blocks");
  const edgeTypeMap = new Map<string, string>(edges.map((e) => [e.id, e.type]));

  if (depEdges.length > 0 || blocksEdges.length > 0) {
    depEdges.forEach((e) => {
      if (nodeIds.has(e.source_id) && nodeIds.has(e.target_id)) {
        g.setEdge(e.target_id, e.source_id, { id: e.id });
      }
    });
    blocksEdges.forEach((e) => {
      if (nodeIds.has(e.source_id) && nodeIds.has(e.target_id)) {
        g.setEdge(e.source_id, e.target_id, { id: e.id });
      }
    });
    const hasIncoming = new Set(depEdges.map((e) => e.source_id));
    nodes.forEach((n) => {
      if ((n.data.type ?? n.data.role) === "stellar" && !hasIncoming.has(n.id)) {
        g.setEdge(VIRTUAL_ROOT_ID, n.id, { id: `${VIRTUAL_ROOT_ID}-${n.id}` });
      }
    });
  } else {
    nodes.forEach((n) => {
      const parentId = n.data.parent_id;
      if (parentId && nodeIds.has(parentId)) {
        g.setEdge(parentId, n.id, { id: `${parentId}-${n.id}` });
      }
    });
    nodes.forEach((n) => {
      if ((n.data.type ?? n.data.role) === "stellar" && !n.data.parent_id) {
        g.setEdge(VIRTUAL_ROOT_ID, n.id, { id: `${VIRTUAL_ROOT_ID}-${n.id}` });
      }
    });
  }

  dagre.layout(g);

  const posNodes: PosNode[] = nodes.map((n) => {
    const pos = g.node(n.id);
    const type = n.data.type ?? n.data.role;
    return {
      id: n.id,
      node: n,
      cx: pos.x,
      cy: pos.y,
      r: NODE_R[type] ?? DEFAULT_R,
    };
  });

  const posEdges: PosEdge[] = g.edges()
    .filter((e) => e.v !== VIRTUAL_ROOT_ID && e.w !== VIRTUAL_ROOT_ID)
    .map((e) => {
      const edgeObj = g.edge(e);
      const edgeId = edgeObj.id ?? `${e.v}-${e.w}`;
      return {
        id: edgeId,
        type: edgeTypeMap.get(edgeId) ?? "depends_on",
        points: edgeObj.points ?? [],
      };
    });

  const graphInfo = g.graph() as { width?: number; height?: number };
  const width = (graphInfo.width ?? 500) + 120;
  const height = (graphInfo.height ?? 400) + 120;

  return { posNodes, posEdges, width, height };
}

function pointsToSvgPath(points: { x: number; y: number }[]): string {
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

// ─── Compass rose ───────────────────────────────────────────────────────────

function CompassRose({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} opacity={0.5}>
      {/* Cardinal spokes */}
      {[0, 90, 180, 270].map((deg) => (
        <line
          key={deg}
          x1={0} y1={0}
          x2={Math.cos((deg - 90) * Math.PI / 180) * 18}
          y2={Math.sin((deg - 90) * Math.PI / 180) * 18}
          stroke="#7c8fa8"
          strokeWidth={1.5}
        />
      ))}
      {/* Ordinal spokes */}
      {[45, 135, 225, 315].map((deg) => (
        <line
          key={deg}
          x1={0} y1={0}
          x2={Math.cos((deg - 90) * Math.PI / 180) * 12}
          y2={Math.sin((deg - 90) * Math.PI / 180) * 12}
          stroke="#5a6880"
          strokeWidth={0.8}
        />
      ))}
      <circle r={3} fill="#9baec0" />
      {/* N label */}
      <text x={0} y={-22} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 8, fill: "#b0c0d0", fontFamily: "serif", fontWeight: 700 }}>
        N
      </text>
    </g>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function WorldMapView() {
  const nodes = useTreeStore((s) => s.nodes);
  const edges = useTreeStore((s) => s.edges);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);

  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 1 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const { posNodes, posEdges, svgWidth, svgHeight } = useMemo(() => {
    const { posNodes, posEdges, width, height } = buildLayout(nodes, edges);
    return {
      posNodes,
      posEdges,
      svgWidth: Math.max(width, 500),
      svgHeight: Math.max(height, 400),
    };
  }, [nodes, edges]);

  const pinnedNode = useMemo(
    () => nodes.find((n) => n.id === pinnedNodeId),
    [nodes, pinnedNodeId]
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as SVGElement).closest("[data-node]")) return;
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

  const onPointerUp = useCallback(() => { isPanning.current = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((t) => {
      const newScale = Math.min(3, Math.max(0.2, t.scale * factor));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { ...t, scale: newScale };
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newX = mx - (mx - t.x) * (newScale / t.scale);
      const newY = my - (my - t.y) * (newScale / t.scale);
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  // Truncate label to fit inside node circle
  function truncLabel(label: string, r: number): string {
    const maxChars = Math.max(4, Math.floor(r / 4.5));
    return label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ background: "#0b0f1c", cursor: isPanning.current ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <svg
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          {/* Amber pulse filter for in_progress */}
          <filter id="wm-glow-amber" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Green steady glow for completed */}
          <filter id="wm-glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Fog of war texture for locked nodes */}
          <pattern id="wm-fog" patternUnits="userSpaceOnUse" width="8" height="8">
            <rect width="8" height="8" fill="transparent" />
            <circle cx="2" cy="2" r="0.8" fill="rgba(100,100,130,0.12)" />
            <circle cx="6" cy="6" r="0.8" fill="rgba(100,100,130,0.08)" />
            <circle cx="6" cy="2" r="0.5" fill="rgba(100,100,130,0.06)" />
          </pattern>

          {/* Hatching for locked node border effect */}
          <pattern id="wm-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(80,80,110,0.15)" strokeWidth="1.5" />
          </pattern>

          {/* Arrowhead for path connectors */}
          <marker id="wm-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(120,140,160,0.7)" />
          </marker>
          <marker id="wm-arrow-blocks" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(248,113,113,0.7)" />
          </marker>

          {/* Search highlight ring */}
          <filter id="wm-glow-search" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Parchment-style background grid (subtle) */}
        <defs>
          <pattern id="wm-grid" patternUnits="userSpaceOnUse" width="40" height="40">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(60,80,100,0.07)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wm-grid)" />

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

          {/* ── Road/path connectors ── */}
          {posEdges.map((edge) => {
            const d = pointsToSvgPath(edge.points);
            if (!d) return null;
            const isBlocks = edge.type === "blocks";
            return (
              <g key={edge.id}>
                {/* Road shadow / ground */}
                <path
                  d={d}
                  fill="none"
                  stroke={isBlocks ? "rgba(150,50,50,0.25)" : "rgba(50,80,80,0.3)"}
                  strokeWidth={isBlocks ? 5 : 6}
                  strokeLinecap="round"
                />
                {/* Road surface */}
                <path
                  d={d}
                  fill="none"
                  stroke={isBlocks ? "rgba(248,113,113,0.55)" : "rgba(100,140,160,0.55)"}
                  strokeWidth={isBlocks ? 2 : 2.5}
                  strokeLinecap="round"
                  strokeDasharray={isBlocks ? "6 4" : undefined}
                  markerEnd={isBlocks ? "url(#wm-arrow-blocks)" : "url(#wm-arrow)"}
                />
              </g>
            );
          })}

          {/* ── Landmark nodes ── */}
          {posNodes.map(({ id, node, cx, cy, r }) => {
            const type = node.data.type ?? node.data.role;
            const status = node.data.status;
            const isPinned = id === pinnedNodeId;
            const isHighlighted = id === searchHighlightId;
            const isHovered = id === hoveredNodeId;
            const isLocked = status === "locked";
            const isActive = status === "in_progress";
            const isDone = status === "completed";

            const fill = terrainFill(type, status);
            const stroke = isHovered ? "#a5b4fc"
              : isPinned ? "#818cf8"
              : isHighlighted ? "#f59e0b"
              : terrainStroke(status);
            const strokeWidth = isPinned || isHighlighted ? 3 : isHovered ? 2.5 : 2;

            // Outermost glow/pulse ring
            const filterAttr = isHighlighted
              ? "url(#wm-glow-search)"
              : glowFilterId(status);

            // Outer terrain ring (decorative for larger nodes)
            const outerRingR = r + (type === "stellar" ? 8 : type === "planet" ? 5 : 3);

            return (
              <g
                key={id}
                data-node="true"
                transform={`translate(${cx},${cy})`}
                style={{ cursor: "pointer" }}
                onClick={() => setPinnedNode(isPinned ? null : id)}
                onMouseEnter={() => setHoveredNodeId(id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Outer decorative terrain ring */}
                <circle
                  r={outerRingR}
                  fill="none"
                  stroke={isLocked ? "rgba(60,60,80,0.3)" : isDone ? "rgba(52,211,153,0.15)" : isActive ? "rgba(245,158,11,0.15)" : "rgba(74,96,128,0.15)"}
                  strokeWidth={1}
                  strokeDasharray={type === "stellar" ? undefined : "3 3"}
                />

                {/* Active pulse ring — animated via CSS */}
                {isActive && (
                  <circle
                    r={r + 6}
                    fill="none"
                    stroke="rgba(245,158,11,0.5)"
                    strokeWidth={2}
                    className="wm-pulse-ring"
                  />
                )}

                {/* Completed outer glow ring */}
                {isDone && (
                  <circle
                    r={r + 5}
                    fill="none"
                    stroke="rgba(52,211,153,0.4)"
                    strokeWidth={1.5}
                    className="wm-glow-ring"
                  />
                )}

                {/* Main node circle with filter */}
                <circle
                  r={r}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  filter={filterAttr}
                />

                {/* Fog of war overlay for locked nodes */}
                {isLocked && (
                  <>
                    <circle r={r} fill="url(#wm-fog)" opacity={0.8} />
                    <circle r={r} fill="url(#wm-hatch)" opacity={0.5} />
                    {/* Lock icon */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      y={0}
                      style={{ fontSize: Math.max(8, r * 0.55), fill: "rgba(100,110,140,0.6)", userSelect: "none" }}
                    >
                      🔒
                    </text>
                  </>
                )}

                {/* Node icon or label (unlocked nodes) */}
                {!isLocked && (
                  <>
                    {node.data.icon ? (
                      <>
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          y={r > 20 ? -6 : 0}
                          style={{ fontSize: Math.max(10, r * 0.55), userSelect: "none" }}
                        >
                          {node.data.icon}
                        </text>
                        {r > 20 && (
                          <text
                            textAnchor="middle"
                            dominantBaseline="middle"
                            y={r * 0.55}
                            style={{
                              fontSize: Math.max(6, Math.min(9, r * 0.38)),
                              fill: isActive ? "#fcd34d" : isDone ? "#6ee7b7" : "#94a3b8",
                              fontFamily: "monospace",
                              fontWeight: 600,
                              userSelect: "none",
                            }}
                          >
                            {truncLabel(node.data.label, r)}
                          </text>
                        )}
                      </>
                    ) : (
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{
                          fontSize: Math.max(6, Math.min(10, r * 0.42)),
                          fill: isActive ? "#fcd34d" : isDone ? "#6ee7b7" : "#c0cfe0",
                          fontFamily: "monospace",
                          fontWeight: 600,
                          userSelect: "none",
                        }}
                      >
                        {truncLabel(node.data.label, r)}
                      </text>
                    )}
                  </>
                )}

                {/* Pinned ring */}
                {isPinned && (
                  <circle r={r + 3} fill="none" stroke="#818cf8" strokeWidth={2} strokeDasharray="4 2" />
                )}
              </g>
            );
          })}

          {/* Compass rose — bottom-right of the layout */}
          <CompassRose x={svgWidth - 50} y={svgHeight - 50} />
        </g>
      </svg>

      {pinnedNode && (
        <NodeDetailPanel node={pinnedNode} pinned onClose={() => setPinnedNode(null)} />
      )}

      <SearchPanel />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 pointer-events-none space-y-1">
        <div className="text-[9px] font-mono text-slate-500 mb-1">Status</div>
        {[
          { label: "Locked", color: "#2a2a3e", stroke: "#2a2a3e", textColor: "#555570" },
          { label: "Active", color: "#4a2a05", stroke: "#f59e0b", textColor: "#fcd34d" },
          { label: "Completed", color: "#14523a", stroke: "#34d399", textColor: "#6ee7b7" },
          { label: "Available", color: "#1e2a45", stroke: "#4a6080", textColor: "#94a3b8" },
        ].map(({ label, color, stroke, textColor }) => (
          <div key={label} className="flex items-center gap-2">
            <svg width="16" height="16">
              <circle cx="8" cy="8" r="6" fill={color} stroke={stroke} strokeWidth="1.5" />
            </svg>
            <span style={{ color: textColor, fontSize: 9, fontFamily: "monospace" }}>{label}</span>
          </div>
        ))}
        <div className="text-[9px] text-slate-600 mt-1 font-mono">drag · scroll · click to pin</div>
      </div>
    </div>
  );
}
