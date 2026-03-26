"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";

// ─── Constants ────────────────────────────────────────────────────────────────

const STELLAR_RADIUS = 28;   // circle radius for phase nodes
const PLANET_RADIUS = 14;    // circle radius for ticket nodes
const ROOT_RADIUS = 36;      // circle radius for central root node

const PHASE_ORBIT_R = 320;   // distance from centre to place stellars
const PLANET_ORBIT_R = 110;  // initial distance from stellar for planets

// Force simulation constants
const REPULSION_K = 8000;
const SPRING_K = 0.04;
const DAMPING = 0.82;
const SIM_STEPS = 180;

const STATUS_COLORS: Record<string, string> = {
  completed:   "#22c55e",
  in_progress: "#f59e0b",
  queued:      "#6366f1",
  locked:      "#334155",
};

const STATUS_GLOW: Record<string, string> = {
  completed:   "#22c55e",
  in_progress: "#f59e0b",
  queued:      "#818cf8",
  locked:      "none",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  node: Node3D | null;   // null for the virtual root
  label: string;
  status: string;
  x: number;
  y: number;
  isStellar: boolean;
  isRoot: boolean;
  parentId: string | null;
  vx: number;
  vy: number;
}

// ─── Force simulation ─────────────────────────────────────────────────────────

function runForceSimulation(nodes: LayoutNode[], steps = SIM_STEPS): LayoutNode[] {
  const ns = nodes.map((n) => ({ ...n }));

  for (let step = 0; step < steps; step++) {
    for (const n of ns) { n.vx = 0; n.vy = 0; }

    // Repulsion between all non-root nodes
    for (let i = 0; i < ns.length; i++) {
      if (ns[i].isRoot) continue;
      for (let j = i + 1; j < ns.length; j++) {
        if (ns[j].isRoot) continue;
        const dx = ns[j].x - ns[i].x;
        const dy = ns[j].y - ns[i].y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const force = REPULSION_K / dist2;
        const d = Math.sqrt(dist2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        ns[i].vx -= fx;
        ns[i].vy -= fy;
        ns[j].vx += fx;
        ns[j].vy += fy;
      }
    }

    // Spring attraction: each node toward its parent
    for (const n of ns) {
      if (n.isRoot || !n.parentId) continue;
      const parent = ns.find((p) => p.id === n.parentId);
      if (!parent) continue;
      const dx = parent.x - n.x;
      const dy = parent.y - n.y;
      n.vx += dx * SPRING_K;
      n.vy += dy * SPRING_K;
    }

    // Apply velocity — stellars stay on orbit ring
    for (const n of ns) {
      if (n.isRoot) continue;
      if (n.isStellar) {
        const angle = Math.atan2(n.y, n.x) + n.vx * 0.0005;
        n.x = Math.cos(angle) * PHASE_ORBIT_R;
        n.y = Math.sin(angle) * PHASE_ORBIT_R;
      } else {
        n.x += n.vx * DAMPING;
        n.y += n.vy * DAMPING;
      }
    }
  }
  return ns;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RadialTreeView() {
  const allNodes      = useTreeStore((s) => s.nodes);
  const edges         = useTreeStore((s) => s.edges);
  const pinnedNodeId  = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, tx: 0, ty: 0 });

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  const pinnedNode = useMemo(
    () => allNodes.find((n) => n.id === pinnedNodeId),
    [allNodes, pinnedNodeId]
  );

  // ── Layout ──────────────────────────────────────────────────────────────────

  const layoutNodes = useMemo<LayoutNode[]>(() => {
    const stellars = allNodes.filter((n) => n.data.type === "stellar");
    const planets  = allNodes.filter((n) => n.data.type !== "stellar");

    const raw: LayoutNode[] = [];

    // Virtual root at centre
    raw.push({
      id: "__ROOT__",
      node: null,
      label: "SkillForge",
      status: "in_progress",
      x: 0, y: 0,
      isStellar: false,
      isRoot: true,
      parentId: null,
      vx: 0, vy: 0,
    });

    // Place stellars evenly around orbit ring
    const angleStep = stellars.length > 0 ? (2 * Math.PI) / stellars.length : 0;
    stellars.forEach((s, i) => {
      const angle = i * angleStep - Math.PI / 2;
      raw.push({
        id: s.id,
        node: s,
        label: s.data.label,
        status: s.data.status,
        x: Math.cos(angle) * PHASE_ORBIT_R,
        y: Math.sin(angle) * PHASE_ORBIT_R,
        isStellar: true,
        isRoot: false,
        parentId: "__ROOT__",
        vx: 0, vy: 0,
      });
    });

    // Place planets near their stellar
    planets.forEach((p) => {
      const parentLn = raw.find((n) => n.id === p.data.parent_id);
      const px = parentLn ? parentLn.x : 0;
      const py = parentLn ? parentLn.y : 0;
      const angle = Math.random() * 2 * Math.PI;
      const dist  = PLANET_ORBIT_R * (0.6 + Math.random() * 0.8);
      raw.push({
        id: p.id,
        node: p,
        label: p.data.label,
        status: p.data.status,
        x: px + Math.cos(angle) * dist,
        y: py + Math.sin(angle) * dist,
        isStellar: false,
        isRoot: false,
        parentId: p.data.parent_id ?? null,
        vx: 0, vy: 0,
      });
    });

    return runForceSimulation(raw, SIM_STEPS);
  }, [allNodes]);

  // ── Centre on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setTransform({ x: width / 2, y: height / 2, scale: 1 });
  }, []);

  // ── Zoom ─────────────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    setTransform((t) => ({ ...t, scale: Math.min(4, Math.max(0.15, t.scale * factor)) }));
  }, []);

  // ── Pan ───────────────────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setTransform((t) => ({ ...t, x: dragState.current.tx + dx, y: dragState.current.ty + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { dragState.current.dragging = false; }, []);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    setTransform({ x: width / 2, y: height / 2, scale: 1 });
  }, []);

  // ── Edge list ─────────────────────────────────────────────────────────────────

  const nodeById = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    layoutNodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [layoutNodes]);

  const renderEdges = useMemo(() => {
    const edgeList: { id: string; x1: number; y1: number; x2: number; y2: number; status: string }[] = [];

    // Structural parent→child edges
    for (const ln of layoutNodes) {
      if (!ln.parentId) continue;
      const parent = nodeById.get(ln.parentId);
      if (!parent) continue;
      edgeList.push({ id: `s-${ln.id}`, x1: parent.x, y1: parent.y, x2: ln.x, y2: ln.y, status: ln.status });
    }

    // Explicit dependency edges (skip if already covered by structural)
    const covered = new Set(layoutNodes.map((ln) => `s-${ln.id}`));
    for (const edge of edges) {
      const src = nodeById.get(edge.source_id);
      const tgt = nodeById.get(edge.target_id);
      if (!src || !tgt) continue;
      if (covered.has(`s-${edge.target_id}`)) continue;
      edgeList.push({ id: `d-${edge.id}`, x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y, status: tgt.status });
    }

    return edgeList;
  }, [layoutNodes, edges, nodeById]);

  // ── Click ─────────────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((nodeId: string) => {
    if (nodeId === "__ROOT__") return;
    setPinnedNode(pinnedNodeId === nodeId ? null : nodeId);
  }, [pinnedNodeId, setPinnedNode]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%", background: "#080f1e", overflow: "hidden", cursor: "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <filter id="glow-completed" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.77  0 0 0 0 0.37  0 0 0 1 0" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-in_progress" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.96  0 0 0 0 0.62  0 0 0 0 0.04  0 0 0 1 0" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-queued" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.39  0 0 0 0 0.40  0 0 0 0 0.95  0 0 0 1 0" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-root" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.39  0 0 0 0 0.40  0 0 0 0 0.95  0 0 0 1 0" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>

          {/* Orbit ring guide (decorative) */}
          <circle
            r={PHASE_ORBIT_R}
            fill="none"
            stroke="#1e293b"
            strokeWidth={1}
            strokeDasharray="6 8"
            opacity={0.4}
          />

          {/* Edges */}
          {renderEdges.map((e) => {
            const glowColor = STATUS_GLOW[e.status] ?? "none";
            return (
              <line
                key={e.id}
                x1={e.x1} y1={e.y1}
                x2={e.x2} y2={e.y2}
                stroke={glowColor === "none" ? "#1e293b" : glowColor}
                strokeWidth={e.status === "locked" ? 0.8 : 1.2}
                strokeOpacity={e.status === "locked" ? 0.18 : 0.35}
                strokeDasharray={e.status === "locked" ? "4 4" : undefined}
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((ln) => {
            const status = ln.status;
            const isHighlighted = ln.id === searchHighlightId;
            const isPinned = ln.id === pinnedNodeId;
            const fillColor = STATUS_COLORS[status] ?? "#1e293b";
            const glowFilter = ln.isRoot
              ? "url(#glow-root)"
              : status === "locked"
              ? undefined
              : `url(#glow-${status})`;
            const r = ln.isRoot ? ROOT_RADIUS : ln.isStellar ? STELLAR_RADIUS : PLANET_RADIUS;

            return (
              <g
                key={ln.id}
                transform={`translate(${ln.x},${ln.y})`}
                onClick={() => handleNodeClick(ln.id)}
                style={{ cursor: ln.isRoot ? "default" : "pointer" }}
              >
                {/* Pinned / search highlight ring */}
                {(isPinned || isHighlighted) && (
                  <circle
                    r={r + 8}
                    fill="none"
                    stroke={isHighlighted ? "#facc15" : "#818cf8"}
                    strokeWidth={2}
                    opacity={0.7}
                  />
                )}

                {/* Pulsing ring for in_progress */}
                {status === "in_progress" && !ln.isRoot && (
                  <circle r={r + 5} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.35}>
                    <animate attributeName="r" from={String(r + 3)} to={String(r + 10)} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Main circle */}
                <circle
                  r={r}
                  fill={
                    ln.isRoot ? "#0f172a"
                    : status === "locked" ? "#0a0f1e"
                    : status === "queued" ? "transparent"
                    : fillColor + "33"
                  }
                  stroke={
                    ln.isRoot ? "#6366f1"
                    : status === "locked" ? "#1e293b"
                    : fillColor
                  }
                  strokeWidth={ln.isRoot ? 3 : ln.isStellar ? 2.5 : status === "queued" ? 2 : 1.5}
                  filter={glowFilter}
                  opacity={status === "locked" ? 0.5 : 1}
                />

                {/* Inner fill dot for completed / in_progress */}
                {(status === "completed" || status === "in_progress") && !ln.isRoot && (
                  <circle r={r * 0.45} fill={fillColor} opacity={0.9} />
                )}

                {/* Root inner glow + core */}
                {ln.isRoot && (
                  <>
                    <circle r={r * 0.55} fill="#1e1b4b" filter="url(#glow-root)" />
                    <circle r={r * 0.3} fill="#6366f1" opacity={0.85} />
                    <circle r={r * 0.12} fill="#a5b4fc" />
                  </>
                )}

                {/* Label below stellar / root */}
                {(ln.isRoot || ln.isStellar) && (
                  <text
                    y={r + 16}
                    textAnchor="middle"
                    fontSize={ln.isRoot ? 11 : 10}
                    fontFamily="monospace"
                    fontWeight={600}
                    fill={status === "locked" ? "#475569" : "#e2e8f0"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {ln.label}
                  </text>
                )}

                {/* Tooltip for planet nodes */}
                {!ln.isRoot && !ln.isStellar && (
                  <title>{ln.label} [{status}]</title>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Fit button */}
      <button
        onClick={fitToScreen}
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

      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Click node to inspect · Drag to pan · Scroll to zoom
      </div>
    </div>
  );
}
