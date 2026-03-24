"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";

// Layout constants
const NODE_W = 140;
const NODE_H = 52;
const H_GAP = 40;   // horizontal gap between sibling subtrees
const V_GAP = 80;   // vertical gap between levels

interface LayoutNode {
  id: string;
  node: Node3D;
  x: number;
  y: number;
  width: number; // subtree width used for centering
  children: LayoutNode[];
}

function buildTree(nodes: Node3D[]): LayoutNode[] {
  const map = new Map<string, LayoutNode>();
  // Initialise all
  nodes.forEach((n) => {
    map.set(n.id, { id: n.id, node: n, x: 0, y: 0, width: NODE_W, children: [] });
  });

  const roots: LayoutNode[] = [];
  nodes.forEach((n) => {
    const parentId = n.data.parent_id;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(map.get(n.id)!);
    } else {
      roots.push(map.get(n.id)!);
    }
  });
  return roots;
}

/** Recursively compute subtree widths bottom-up, then assign positions top-down. */
function measureSubtree(node: LayoutNode): number {
  if (node.children.length === 0) {
    node.width = NODE_W;
    return NODE_W;
  }
  const childrenTotal = node.children.reduce((sum, c) => sum + measureSubtree(c) + H_GAP, -H_GAP);
  node.width = Math.max(NODE_W, childrenTotal);
  return node.width;
}

function placeSubtree(node: LayoutNode, cx: number, y: number) {
  node.x = cx - NODE_W / 2;
  node.y = y;

  if (node.children.length === 0) return;
  const childY = y + NODE_H + V_GAP;
  let startX = cx - node.width / 2;
  node.children.forEach((c) => {
    const childCx = startX + c.width / 2;
    placeSubtree(c, childCx, childY);
    startX += c.width + H_GAP;
  });
}

function flattenLayout(roots: LayoutNode[]): LayoutNode[] {
  const all: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    all.push(n);
    n.children.forEach(walk);
  }
  roots.forEach(walk);
  return all;
}

/** Build edges list: parent → child connections. */
function buildEdges(flat: LayoutNode[]): { x1: number; y1: number; x2: number; y2: number; id: string }[] {
  const edges: { x1: number; y1: number; x2: number; y2: number; id: string }[] = [];
  flat.forEach((n) => {
    n.children.forEach((c) => {
      edges.push({
        id: `${n.id}-${c.id}`,
        x1: n.x + NODE_W / 2,
        y1: n.y + NODE_H,
        x2: c.x + NODE_W / 2,
        y2: c.y,
      });
    });
  });
  return edges;
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
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);

  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 40, scale: 1 });
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Build layout
  const { flat, edges, svgWidth, svgHeight } = useMemo(() => {
    const roots = buildTree(nodes);
    roots.forEach(measureSubtree);

    // Place roots side by side
    let xCursor = H_GAP;
    roots.forEach((r) => {
      placeSubtree(r, xCursor + r.width / 2, V_GAP);
      xCursor += r.width + H_GAP * 2;
    });

    const flat = flattenLayout(roots);
    const edges = buildEdges(flat);

    const maxX = flat.reduce((m, n) => Math.max(m, n.x + NODE_W), 0) + H_GAP;
    const maxY = flat.reduce((m, n) => Math.max(m, n.y + NODE_H), 0) + V_GAP;

    return { flat, edges, svgWidth: Math.max(maxX, 400), svgHeight: Math.max(maxY, 300) };
  }, [nodes]);

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
      // zoom toward cursor
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
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {edges.map((e) => {
            const mx = (e.x1 + e.x2) / 2;
            const my = (e.y1 + e.y2) / 2;
            return (
              <path
                key={e.id}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${my}, ${e.x2} ${my}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke="rgba(148,163,184,0.25)"
                strokeWidth={1.5}
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
        {flat.map(({ id, node, x, y }) => {
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
