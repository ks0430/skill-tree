"use client";

/**
 * Memory Map view — associative force-directed layout.
 *
 * Nodes cluster by semantic closeness, not strict hierarchy:
 *   - `parent` edges pull strongly   → hierarchical clusters stay tight
 *   - `depends_on` / `blocks` edges  → moderate dependency pull
 *   - `related` edges pull softly    → associative drift
 *   - `references` edges barely pull → faint citation link
 *
 * Edge colour encodes type at a glance:
 *   parent       → indigo
 *   depends_on   → amber
 *   blocks       → rose
 *   related      → emerald
 *   references   → slate
 */

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";
import {
  computeMemoryMapLayout,
  stepForce,
  type ForceNode,
  type ForceEdge,
  MEMORY_MAP_PULL_STRENGTH,
} from "@/lib/force/layout";
import type { EdgeType } from "@/types/skill-tree";

// ─── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 900;

const NODE_BASE_R = 18;
const NODE_DEGREE_SCALE = 2.5;
const NODE_MAX_R = 42;

const STATUS_COLORS: Record<string, string> = {
  completed: "#34d399",
  in_progress: "#f59e0b",
  locked: "#334155",
};

const TYPE_BORDER: Record<string, string> = {
  stellar: "#818cf8",
  planet: "#34d399",
  satellite: "#94a3b8",
};

/** Stroke colour per edge type — semantic encoding. */
const EDGE_TYPE_COLOR: Record<EdgeType, string> = {
  parent: "#818cf8",       // indigo  — strong hierarchy
  depends_on: "#f59e0b",   // amber   — dependency
  blocks: "#f87171",       // rose    — blocker
  related: "#34d399",      // emerald — association
  references: "#64748b",   // slate   — citation
};

/** Base opacity per edge type (fainter = weaker pull). */
const EDGE_TYPE_OPACITY: Record<EdgeType, number> = {
  parent: 0.75,
  depends_on: 0.6,
  blocks: 0.55,
  related: 0.35,
  references: 0.2,
};

/** Stroke width per edge type. */
const EDGE_TYPE_WIDTH: Record<EdgeType, number> = {
  parent: 2.5,
  depends_on: 1.8,
  blocks: 1.5,
  related: 1.2,
  references: 0.8,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function nodeRadius(degree: number): number {
  return Math.min(NODE_BASE_R + degree * NODE_DEGREE_SCALE, NODE_MAX_R);
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MemoryMapView() {
  const nodes = useTreeStore((s) => s.nodes);
  const edges = useTreeStore((s) => s.edges);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Hover
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Animated node positions
  const [forceNodes, setForceNodes] = useState<ForceNode[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const forceNodesRef = useRef<ForceNode[]>([]);

  // Build ForceEdge list from store edges — include edgeType for tiered pull
  const forceEdges = useMemo<ForceEdge[]>(() => {
    return edges.map((e) => ({
      source: e.source_id,
      target: e.target_id,
      weight: e.weight ?? 1,
      edgeType: e.type,
    }));
  }, [edges]);

  // Rebuild layout when nodes/edges change
  useEffect(() => {
    const nodeIds = nodes.map((n) => n.id);
    if (nodeIds.length === 0) {
      setForceNodes([]);
      forceNodesRef.current = [];
      return;
    }

    const initial = computeMemoryMapLayout(nodeIds, forceEdges, {
      width: CANVAS_W,
      height: CANVAS_H,
      iterations: 200,
    });
    forceNodesRef.current = initial;
    setForceNodes([...initial]);

    // Continue settling with animation — use type-scaled edges so animation
    // respects the same pull strengths as the initial batch layout.
    let stopped = false;
    const stepCfg = {
      springLength: 140,
      springK: 0.05,
      repulsionK: 6000,
      damping: 0.78,
      iterations: 300,
      minDist: 30,
    };

    // Scale edges once for the animation loop
    const scaledEdges: ForceEdge[] = forceEdges.map((e) => {
      const typeMultiplier =
        e.edgeType !== undefined
          ? (MEMORY_MAP_PULL_STRENGTH[e.edgeType] ?? 1)
          : 1;
      return { ...e, weight: (e.weight > 0 ? e.weight : 1) * typeMultiplier };
    });

    const tick = () => {
      if (stopped) return;
      const maxV = stepForce(forceNodesRef.current, scaledEdges, stepCfg);
      setForceNodes([...forceNodesRef.current]);
      if (maxV > 0.15) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length]);

  // Build node lookup map
  const nodeMap = useMemo(
    () => new Map<string, Node3D>(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  // Hover chain — connected nodes + edges
  const hoveredChain = useMemo(() => {
    if (!hoveredNodeId) return null;
    const chain = new Set<string>([hoveredNodeId]);
    edges.forEach((e) => {
      if (e.source_id === hoveredNodeId) chain.add(e.target_id);
      if (e.target_id === hoveredNodeId) chain.add(e.source_id);
    });
    return chain;
  }, [hoveredNodeId, edges]);

  const chainEdgeIds = useMemo(() => {
    if (!hoveredChain) return null;
    const ids = new Set<string>();
    edges.forEach((e) => {
      if (hoveredChain.has(e.source_id) && hoveredChain.has(e.target_id)) {
        ids.add(e.id);
      }
    });
    return ids;
  }, [hoveredChain, edges]);

  // ── Panning ─────────────────────────────────────────────────────────────────

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

  // Position lookup
  const posMap = useMemo(
    () => new Map<string, ForceNode>(forceNodes.map((fn) => [fn.id, fn])),
    [forceNodes]
  );

  const pinnedNode = useMemo(
    () => nodes.find((n) => n.id === pinnedNodeId),
    [nodes, pinnedNodeId]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ background: "#05080f", cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <defs>
          {/* Arrow markers per edge type */}
          {(Object.keys(EDGE_TYPE_COLOR) as EdgeType[]).map((type) => (
            <marker
              key={type}
              id={`mm-arrow-${type}`}
              markerWidth="7"
              markerHeight="5"
              refX="6"
              refY="2.5"
              orient="auto"
            >
              <polygon points="0 0, 7 2.5, 0 5" fill={EDGE_TYPE_COLOR[type]} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* ── Edges ── */}
          {edges.map((e) => {
            const src = posMap.get(e.source_id);
            const tgt = posMap.get(e.target_id);
            if (!src || !tgt) return null;

            const srcDeg = posMap.get(e.source_id)?.degree ?? 0;
            const tgtDeg = posMap.get(e.target_id)?.degree ?? 0;
            const srcR = nodeRadius(srcDeg);
            const tgtR = nodeRadius(tgtDeg);

            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;
            const x1 = src.x + ux * srcR;
            const y1 = src.y + uy * srcR;
            const x2 = tgt.x - ux * (tgtR + 7);
            const y2 = tgt.y - uy * (tgtR + 7);

            const edgeType = (e.type ?? "related") as EdgeType;
            const isChain = chainEdgeIds ? chainEdgeIds.has(e.id) : false;
            const isDimmed = hoveredNodeId !== null && !isChain;
            const baseOpacity = EDGE_TYPE_OPACITY[edgeType] ?? 0.35;
            const stroke = EDGE_TYPE_COLOR[edgeType] ?? "#64748b";
            const strokeW = EDGE_TYPE_WIDTH[edgeType] ?? 1;

            return (
              <line
                key={e.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={isChain ? strokeW + 0.8 : strokeW}
                strokeOpacity={isDimmed ? 0.04 : isChain ? Math.min(baseOpacity + 0.25, 1) : baseOpacity}
                markerEnd={`url(#mm-arrow-${edgeType})`}
                style={{ transition: "stroke-opacity 0.15s" }}
              />
            );
          })}

          {/* ── Nodes ── */}
          {forceNodes.map((fn) => {
            const storeNode = nodeMap.get(fn.id);
            if (!storeNode) return null;

            const type = storeNode.data.type ?? storeNode.data.role;
            const status = storeNode.data.status;
            const r = nodeRadius(fn.degree);
            const isPinned = fn.id === pinnedNodeId;
            const isHighlighted = fn.id === searchHighlightId;
            const isInChain = hoveredChain ? hoveredChain.has(fn.id) : false;
            const isHovered = fn.id === hoveredNodeId;
            const isDimmed = hoveredNodeId !== null && !isInChain;

            const borderColor = isHovered || isInChain
              ? "#a5b4fc"
              : TYPE_BORDER[type] ?? "#475569";

            const fillColor = isHovered
              ? "rgba(99,102,241,0.38)"
              : isInChain
              ? "rgba(99,102,241,0.2)"
              : isPinned
              ? "rgba(99,102,241,0.24)"
              : status === "locked"
              ? "rgba(8,12,22,0.85)"
              : "rgba(12,18,36,0.9)";

            const glowFilter = isHighlighted
              ? "drop-shadow(0 0 8px #f59e0b)"
              : isHovered
              ? "drop-shadow(0 0 12px rgba(165,180,252,0.9))"
              : isInChain
              ? "drop-shadow(0 0 6px rgba(165,180,252,0.45))"
              : undefined;

            return (
              <g
                key={fn.id}
                data-node="true"
                transform={`translate(${fn.x},${fn.y})`}
                style={{
                  cursor: "pointer",
                  opacity: isDimmed ? 0.18 : status === "locked" ? 0.45 : 1,
                  transition: "opacity 0.15s",
                  filter: glowFilter,
                }}
                onClick={() => setPinnedNode(isPinned ? null : fn.id)}
                onMouseEnter={() => setHoveredNodeId(fn.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <circle
                  r={r}
                  fill={fillColor}
                  stroke={borderColor}
                  strokeWidth={isPinned ? 2.5 : isInChain ? 2 : 1.5}
                />
                {/* Status dot */}
                <circle
                  cx={0}
                  cy={r - 5}
                  r={3.5}
                  fill={STATUS_COLORS[status] ?? "#475569"}
                />
                {r >= 20 && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    y={-4}
                    style={{
                      fontSize: Math.max(7, Math.min(10, r * 0.46)),
                      fontFamily: "monospace",
                      fontWeight: 600,
                      fill: "#e2e8f0",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {storeNode.data.label.length > 14
                      ? storeNode.data.label.slice(0, 13) + "…"
                      : storeNode.data.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Detail panel */}
      {pinnedNode && (
        <NodeDetailPanel
          node={pinnedNode}
          pinned
          onClose={() => setPinnedNode(null)}
        />
      )}

      <SearchPanel />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 pointer-events-none space-y-0.5">
        <div className="text-[10px] text-slate-500 mb-1 font-mono">Edge types</div>
        {(Object.entries(EDGE_TYPE_COLOR) as [EdgeType, string][]).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div
              className="w-5 h-px rounded"
              style={{ backgroundColor: color, opacity: EDGE_TYPE_OPACITY[type] + 0.2, height: EDGE_TYPE_WIDTH[type] + 0.5 }}
            />
            <span className="text-[9px] font-mono" style={{ color }}>
              {type} ×{MEMORY_MAP_PULL_STRENGTH[type].toFixed(1)}
            </span>
          </div>
        ))}
        <div className="text-[9px] text-slate-600 mt-1">drag · scroll · / search</div>
      </div>
    </div>
  );
}
