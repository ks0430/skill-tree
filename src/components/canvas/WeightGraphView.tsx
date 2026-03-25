"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";
import {
  computeForceLayout,
  stepForce,
  type ForceNode,
  type ForceEdge,
} from "@/lib/force/layout";

// ─── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 900;

/** Base radius for a node with degree = 0. */
const NODE_BASE_R = 20;
/** Extra radius added per connected edge (degree). */
const NODE_DEGREE_SCALE = 3;
/** Maximum node radius. */
const NODE_MAX_R = 44;

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function nodeRadius(degree: number): number {
  return Math.min(NODE_BASE_R + degree * NODE_DEGREE_SCALE, NODE_MAX_R);
}

/** Map edge weight to stroke width (1–6 px). */
function edgeStrokeWidth(weight: number): number {
  return Math.max(1, Math.min(6, 1 + weight * 3));
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function WeightGraphView() {
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

  // Animated node positions — start from batch layout, then settle
  const [forceNodes, setForceNodes] = useState<ForceNode[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const forceNodesRef = useRef<ForceNode[]>([]);

  // Build ForceEdge list from store edges
  const forceEdges = useMemo<ForceEdge[]>(() => {
    return edges.map((e) => ({
      source: e.source_id,
      target: e.target_id,
      weight: e.weight ?? 1,
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

    const initial = computeForceLayout(nodeIds, forceEdges, {
      width: CANVAS_W,
      height: CANVAS_H,
      iterations: 150,
    });
    forceNodesRef.current = initial;
    setForceNodes([...initial]);

    // Continue settling with animation
    let stopped = false;
    const stepCfg = {
      springLength: 180,
      springK: 0.04,
      repulsionK: 8000,
      damping: 0.8,
      iterations: 150,
      minDist: 30,
    };

    const tick = () => {
      if (stopped) return;
      const maxV = stepForce(forceNodesRef.current, forceEdges, stepCfg);
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

  // Build node lookup map (id → Node3D)
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

  // Build a position lookup for forceNodes
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
      style={{ background: "#060a14", cursor: "grab" }}
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
          <marker id="wg-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="rgba(148,163,184,0.7)" />
          </marker>
          <marker id="wg-arrow-chain" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#818cf8" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* ── Edges ── */}
          {edges.map((e) => {
            const src = posMap.get(e.source_id);
            const tgt = posMap.get(e.target_id);
            if (!src || !tgt) return null;

            const srcNode = nodeMap.get(e.source_id);
            const tgtNode = nodeMap.get(e.target_id);
            const srcDeg = posMap.get(e.source_id)?.degree ?? 0;
            const tgtDeg = posMap.get(e.target_id)?.degree ?? 0;
            const srcR = nodeRadius(srcDeg);
            const tgtR = nodeRadius(tgtDeg);

            // Shorten line so it starts/ends at node border
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;
            const x1 = src.x + ux * srcR;
            const y1 = src.y + uy * srcR;
            const x2 = tgt.x - ux * (tgtR + 8); // +8 for arrowhead
            const y2 = tgt.y - uy * (tgtR + 8);

            const isChain = chainEdgeIds ? chainEdgeIds.has(e.id) : false;
            const isDimmed = hoveredNodeId !== null && !isChain;
            const strokeW = edgeStrokeWidth(e.weight ?? 1);
            const stroke = isChain ? "#818cf8" : "rgba(148,163,184,0.55)";

            return (
              <line
                key={e.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={strokeW}
                strokeOpacity={isDimmed ? 0.08 : 1}
                markerEnd={isChain ? "url(#wg-arrow-chain)" : "url(#wg-arrow)"}
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
              ? "#818cf8"
              : TYPE_BORDER[type] ?? "#475569";
            const fillColor = isHovered
              ? "rgba(99,102,241,0.35)"
              : isInChain
              ? "rgba(99,102,241,0.18)"
              : isPinned
              ? "rgba(99,102,241,0.22)"
              : status === "locked"
              ? "rgba(10,14,26,0.8)"
              : "rgba(15,22,41,0.88)";

            const glowFilter = isHighlighted
              ? "drop-shadow(0 0 8px #f59e0b)"
              : isHovered
              ? "drop-shadow(0 0 10px rgba(129,140,248,0.8))"
              : isInChain
              ? "drop-shadow(0 0 6px rgba(129,140,248,0.4))"
              : undefined;

            return (
              <g
                key={fn.id}
                data-node="true"
                transform={`translate(${fn.x},${fn.y})`}
                style={{ cursor: "pointer", opacity: isDimmed ? 0.2 : status === "locked" ? 0.5 : 1, transition: "opacity 0.15s", filter: glowFilter }}
                onClick={() => setPinnedNode(isPinned ? null : fn.id)}
                onMouseEnter={() => setHoveredNodeId(fn.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Circle */}
                <circle
                  r={r}
                  fill={fillColor}
                  stroke={borderColor}
                  strokeWidth={isPinned ? 2.5 : isInChain ? 2 : 1.5}
                />
                {/* Status dot */}
                <circle
                  cx={0}
                  cy={r - 6}
                  r={4}
                  fill={STATUS_COLORS[status] ?? "#475569"}
                />
                {/* Label — only render when radius large enough */}
                {r >= 22 && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    y={-4}
                    style={{
                      fontSize: Math.max(8, Math.min(11, r * 0.48)),
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

      {/* Hint */}
      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Force graph — node size = connections · edge thickness = weight · drag to pan · scroll to zoom · / to search
      </div>
    </div>
  );
}
