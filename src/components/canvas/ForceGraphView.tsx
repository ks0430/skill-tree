"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";
import type { ForceGraphMethods } from "react-force-graph-2d";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed:   "#22c55e",
  in_progress: "#f59e0b",
  queued:      "#6366f1",
  locked:      "#1e293b",
};

const STATUS_BORDER: Record<string, string> = {
  completed:   "#22c55e",
  in_progress: "#f59e0b",
  queued:      "#818cf8",
  locked:      "#334155",
};

// Phase colors cycle
const PHASE_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#f43f5e", "#a78bfa",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Simple deterministic hash for a string → int */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Draw a regular polygon centred at (0,0) with given radius and N sides */
function drawPolygon(ctx: CanvasRenderingContext2D, sides: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Draw inner pattern (2-3 lines) seeded from node id */
function drawInnerPattern(ctx: CanvasRenderingContext2D, nodeId: string, r: number) {
  const h = hashStr(nodeId);
  const pattern = h % 3; // 0,1,2
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  if (pattern === 0) {
    // horizontal lines
    ctx.moveTo(-r * 0.4, -r * 0.15); ctx.lineTo(r * 0.4, -r * 0.15);
    ctx.moveTo(-r * 0.3, r * 0.15);  ctx.lineTo(r * 0.3, r * 0.15);
  } else if (pattern === 1) {
    // X cross
    ctx.moveTo(-r * 0.35, -r * 0.35); ctx.lineTo(r * 0.35, r * 0.35);
    ctx.moveTo(r * 0.35, -r * 0.35);  ctx.lineTo(-r * 0.35, r * 0.35);
  } else {
    // vertical + horizontal
    ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, r * 0.4);
    ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0);
  }
  ctx.stroke();
}

// ─── Graph data types ─────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  status: string;
  nodeType: "stellar" | "planet" | "root";
  phaseNum: number;
  phaseColor: string;
  priority: number;
  completionPct: number; // 0-1, for stellar arc
  __bckgDimensions?: [number, number];
}

interface GraphLink {
  source: string;
  target: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ForceGraphView() {
  const { nodes, edges } = useTreeStore((s) => ({ nodes: s.nodes, edges: s.edges }));
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode>>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [pinnedNode, setPinnedNode] = useState<Node3D | null>(null);
  const [tick, setTick] = useState(0); // for animation

  // Animation ticker for pulsing in_progress nodes
  useEffect(() => {
    let raf: number;
    function animate() {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDimensions({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(el);
    setDimensions({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // Build graph data from store
  const graphData = useMemo(() => {
    // Group nodes by phase (stellar parent)
    const stellarNodes = nodes.filter((n) => n.data.type === "stellar" || n.data.role === "stellar");
    const planetNodes  = nodes.filter((n) => n.data.type === "planet"  || n.data.role === "planet");

    // Build stellar completion map
    const stellarCompletionMap: Record<string, { total: number; done: number }> = {};
    for (const s of stellarNodes) {
      stellarCompletionMap[s.id] = { total: 0, done: 0 };
    }
    for (const p of planetNodes) {
      const pid = p.data.parent_id ?? "";
      if (stellarCompletionMap[pid]) {
        stellarCompletionMap[pid].total++;
        if (p.data.status === "completed") stellarCompletionMap[pid].done++;
      }
    }

    const gNodes: GraphNode[] = [];
    const gLinks: GraphLink[] = [];

    // Stellar nodes
    stellarNodes.forEach((n, i) => {
      const comp = stellarCompletionMap[n.id] ?? { total: 1, done: 0 };
      gNodes.push({
        id: n.id,
        label: n.data.label,
        status: n.data.status,
        nodeType: "stellar",
        phaseNum: i + 1,
        phaseColor: PHASE_COLORS[i % PHASE_COLORS.length],
        priority: n.data.priority ?? 1,
        completionPct: comp.total > 0 ? comp.done / comp.total : 0,
      });
    });

    // Planet nodes
    for (const n of planetNodes) {
      gNodes.push({
        id: n.id,
        label: n.data.label,
        status: n.data.status,
        nodeType: "planet",
        phaseNum: 0,
        phaseColor: STATUS_COLORS[n.data.status] ?? "#6366f1",
        priority: n.data.priority ?? 1,
        completionPct: 0,
      });
    }

    // Links from edges
    for (const e of edges) {
      gLinks.push({ source: e.source_id, target: e.target_id });
    }

    // Fallback: add parent links if not in edges
    for (const n of planetNodes) {
      if (n.data.parent_id) {
        const already = gLinks.find(
          (l) =>
            (l.source === n.id && l.target === n.data.parent_id) ||
            (l.source === n.data.parent_id && l.target === n.id)
        );
        if (!already) {
          gLinks.push({ source: n.data.parent_id, target: n.id });
        }
      }
    }

    return { nodes: gNodes, links: gLinks };
  }, [nodes, edges]);

  // Custom node canvas renderer
  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { id, label, status, nodeType, phaseNum, phaseColor, priority, completionPct } = node;
      const x = 0, y = 0;
      void label; void globalScale;

      ctx.save();

      if (nodeType === "stellar") {
        const r = 20;
        const color = phaseColor;

        // Glow for completed
        if (status === "completed") {
          ctx.beginPath();
          ctx.arc(x, y, r + 4, 0, Math.PI * 2);
          ctx.fillStyle = color + "4D"; // 30% opacity
          ctx.fill();
        }

        // Background circle
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color + "33";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Completion arc (outer ring)
        if (completionPct > 0) {
          ctx.beginPath();
          ctx.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + completionPct * Math.PI * 2);
          ctx.strokeStyle = "#22c55e";
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // Phase number in centre
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `bold ${Math.max(10, r * 0.7)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(phaseNum), x, y);

      } else {
        // Planet node — polygon shape
        const sides = (hashStr(id) % 4) + 3; // 3–6
        const baseR = 8 + Math.min(priority, 5) * 1.5; // size by priority
        const color = STATUS_COLORS[status] ?? "#6366f1";
        const borderColor = STATUS_BORDER[status] ?? "#818cf8";

        // Pulsing for in_progress
        let r = baseR;
        if (status === "in_progress") {
          const pulse = Math.sin(Date.now() / 400) * 0.12 + 1;
          r = baseR * pulse;
        }

        // Glow for completed
        if (status === "completed") {
          drawPolygon(ctx, sides, r + 3);
          ctx.fillStyle = color + "4D";
          ctx.fill();
        }

        // Main polygon fill
        drawPolygon(ctx, sides, r);
        ctx.fillStyle = color + "33";
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = status === "locked" ? 1 : 1.5;
        ctx.stroke();

        // Inner pattern
        if (status !== "locked") {
          drawInnerPattern(ctx, id, r);
        }
      }

      ctx.restore();

      // Store bounding dims for pointer detection
      const bounding = nodeType === "stellar" ? 24 : 12 + Math.min(priority, 5) * 1.5;
      node.__bckgDimensions = [bounding * 2, bounding * 2];
    },
    // tick in deps to force re-render for pulse animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick]
  );

  // Pointer area
  const nodePointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      void color;
      const r = node.nodeType === "stellar" ? 24 : 14;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    },
    []
  );

  // Click handler
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.nodeType === "stellar") {
        // Zoom to cluster
        graphRef.current?.zoomToFit(400, 60, (n: GraphNode) => {
          if (n.id === node.id) return true;
          // include planets of this stellar
          const storeNode = nodes.find((x) => x.id === n.id);
          return storeNode?.data.parent_id === node.id;
        });
      } else {
        // Show detail panel
        const storeNode = nodes.find((n) => n.id === node.id);
        if (storeNode) setPinnedNode(storeNode);
      }
    },
    [nodes]
  );

  // Hover handler
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#050810" }}
    >
      {/* @ts-expect-error — dynamic import types */}
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#050810"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={nodePointerArea}
        nodeRelSize={6}
        warmupTicks={100}
        cooldownTicks={0}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        linkColor={() => "#1e293b"}
        linkWidth={1}
        linkDirectionalParticles={0}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />

      {/* Hover label tooltip */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 rounded text-xs font-mono text-slate-200"
          style={{
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15,22,41,0.92)",
            border: "1px solid #334155",
            maxWidth: 260,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hoveredNode.label}{" "}
          <span style={{ color: STATUS_COLORS[hoveredNode.status] ?? "#94a3b8" }}>
            [{hoveredNode.status}]
          </span>
        </div>
      )}

      {/* Legend */}
      <div
        className="absolute bottom-4 left-4 text-[10px] font-mono pointer-events-none flex flex-col gap-1"
        style={{ color: "#475569" }}
      >
        <span>🔵 Phase node — click to zoom cluster</span>
        <span>⬡ Ticket node — click to inspect</span>
        <span>Drag to pan · Scroll to zoom</span>
      </div>

      {/* Fit button */}
      <button
        onClick={() => graphRef.current?.zoomToFit(400, 40)}
        style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(15,22,41,0.85)", border: "1px solid #334155",
          borderRadius: 6, color: "#94a3b8", fontSize: 11, fontFamily: "monospace",
          padding: "5px 10px", cursor: "pointer", zIndex: 10,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#818cf8";
          (e.currentTarget as HTMLButtonElement).style.color = "#a5b4fc";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#334155";
          (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
        }}
        title="Fit to screen"
      >
        ⊞ Fit
      </button>

      {pinnedNode && (
        <NodeDetailPanel node={pinnedNode} pinned onClose={() => setPinnedNode(null)} />
      )}
      <SearchPanel />
    </div>
  );
}
