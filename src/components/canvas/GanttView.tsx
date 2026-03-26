"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useTreeStore } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";
import {
  computeGanttLayout,
  generateMonthTicks,
  LABEL_COL_WIDTH,
  ROW_HEIGHT,
  SWIMLANE_HEADER_HEIGHT,
  PX_PER_DAY,
} from "@/lib/gantt/layout";

/**
 * Bar colours for each ticket status.
 * Bars span created_at → completed_at (actual ticket duration from pm_tickets).
 */
const STATUS_COLORS: Record<string, string> = {
  completed:   "#22d3ee",   // cyan   — ticket finished
  in_progress: "#f59e0b",   // amber  — actively being worked
  queued:      "#a78bfa",   // violet — waiting to start
  locked:      "#475569",   // slate  — not yet reachable
};

const TYPE_COLORS: Record<string, string> = {
  stellar: "#818cf8",
  planet: "#34d399",
  satellite: "#94a3b8",
};

const AXIS_HEIGHT = 36;

export function GanttView() {
  const nodes = useTreeStore((s) => s.nodes);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const searchHighlightId = useTreeStore((s) => s.searchHighlightId);

  // Pan state for the timeline area
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => computeGanttLayout(nodes), [nodes]);
  const ticks = useMemo(() => generateMonthTicks(layout), [layout]);

  const pinnedNode = useMemo(() => nodes.find((n) => n.id === pinnedNodeId), [nodes, pinnedNodeId]);

  // Today marker
  const todayOffset = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = (today.getTime() - layout.epochDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(diff * PX_PER_DAY);
  }, [layout.epochDate]);

  // Auto-scroll to center today on mount
  useEffect(() => {
    if (todayOffset <= 0) return;
    const containerWidth = containerRef.current?.clientWidth ?? 800;
    const viewableWidth = containerWidth - LABEL_COL_WIDTH;
    const target = Math.max(0, todayOffset - Math.floor(viewableWidth / 2));
    setScrollLeft(target);
  }, [todayOffset]);

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
    setScrollLeft((s) => Math.max(0, s - dx));
    setScrollTop((s) => Math.max(0, s - dy));
  }, []);

  const onPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden select-none"
      style={{ background: "#0a0e1a", cursor: "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Fixed label column header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: LABEL_COL_WIDTH,
          height: AXIS_HEIGHT,
          background: "#0d1224",
          borderRight: "1px solid rgba(148,163,184,0.1)",
          borderBottom: "1px solid rgba(148,163,184,0.12)",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
        }}
      >
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Agent / Node
        </span>
      </div>

      {/* Axis ticks (scrolls horizontally only) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: LABEL_COL_WIDTH,
          right: 0,
          height: AXIS_HEIGHT,
          overflow: "hidden",
          borderBottom: "1px solid rgba(148,163,184,0.12)",
          background: "#0d1224",
          zIndex: 10,
        }}
      >
        <div style={{ position: "relative", width: layout.totalWidth, height: AXIS_HEIGHT, transform: `translateX(${-scrollLeft}px)` }}>
          {ticks.map((tick) => (
            <div
              key={tick.label + tick.x}
              style={{
                position: "absolute",
                left: tick.x,
                top: 0,
                height: AXIS_HEIGHT,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                paddingBottom: 6,
                paddingLeft: 6,
                borderLeft: "1px solid rgba(148,163,184,0.08)",
              }}
            >
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>
                {tick.label}
              </span>
            </div>
          ))}
          {/* Today marker on axis — pill chip */}
          {todayOffset >= 0 && (
            <div
              style={{
                position: "absolute",
                left: todayOffset,
                top: 0,
                height: AXIS_HEIGHT,
                borderLeft: "1.5px solid #f59e0b",
                display: "flex",
                alignItems: "center",
                paddingLeft: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#0a0e1a",
                  background: "#f59e0b",
                  borderRadius: 3,
                  padding: "1px 5px",
                  whiteSpace: "nowrap",
                  lineHeight: "14px",
                  letterSpacing: "0.04em",
                }}
              >
                {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main scrollable area */}
      <div
        style={{
          position: "absolute",
          top: AXIS_HEIGHT,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        {/* Label column (scrolls vertically) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: LABEL_COL_WIDTH,
            height: layout.totalHeight,
            transform: `translateY(${-scrollTop}px)`,
            background: "#0a0e1a",
            borderRight: "1px solid rgba(148,163,184,0.1)",
            zIndex: 5,
          }}
        >
          {/* Swimlane header labels */}
          {layout.swimlaneHeaders.map((lane) => (
            <div
              key={"lane-label-" + lane.agentName}
              style={{
                position: "absolute",
                top: lane.yTop,
                left: 0,
                width: LABEL_COL_WIDTH,
                height: SWIMLANE_HEADER_HEIGHT,
                display: "flex",
                alignItems: "center",
                paddingLeft: 10,
                paddingRight: 8,
                background: "rgba(99,102,241,0.08)",
                borderTop: "1px solid rgba(99,102,241,0.2)",
                borderBottom: "1px solid rgba(99,102,241,0.12)",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#818cf8",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {lane.agentName}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "#475569",
                  flexShrink: 0,
                  paddingLeft: 4,
                }}
              >
                {lane.rowCount}
              </span>
            </div>
          ))}

          {/* Node rows */}
          {layout.rows.map((row) => {
            const type = row.node.data.type ?? row.node.data.role;
            const isPinned = row.id === pinnedNodeId;
            return (
              <div
                key={row.id}
                data-node="true"
                onClick={() => setPinnedNode(isPinned ? null : row.id)}
                style={{
                  position: "absolute",
                  top: row.yTop,
                  left: 0,
                  width: LABEL_COL_WIDTH,
                  height: ROW_HEIGHT,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: 16,
                  paddingRight: 8,
                  cursor: "pointer",
                  background: isPinned ? "rgba(99,102,241,0.1)" : "transparent",
                  borderLeft: `3px solid ${TYPE_COLORS[type] ?? "#475569"}`,
                  transition: "background 0.12s",
                }}
              >
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#e2e8f0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={row.node.data.label}
                  >
                    {row.node.data.label}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 9, color: "#64748b", marginTop: 2, textTransform: "uppercase" }}>
                    {type}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline area (scrolls both axes) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: LABEL_COL_WIDTH,
            right: 0,
            bottom: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              width: layout.totalWidth,
              height: layout.totalHeight,
              transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`,
            }}
          >
            {/* Month grid lines */}
            {ticks.map((tick) => (
              <div
                key={"grid-" + tick.x}
                style={{
                  position: "absolute",
                  left: tick.x,
                  top: 0,
                  bottom: 0,
                  borderLeft: "1px solid rgba(148,163,184,0.05)",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Today vertical line */}
            {todayOffset >= 0 && (
              <div
                style={{
                  position: "absolute",
                  left: todayOffset,
                  top: 0,
                  bottom: 0,
                  borderLeft: "2px solid rgba(245,158,11,0.75)",
                  boxShadow: "0 0 6px 1px rgba(245,158,11,0.35)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />
            )}

            {/* Swimlane header bands on timeline */}
            {layout.swimlaneHeaders.map((lane) => (
              <div
                key={"lane-band-" + lane.agentName}
                style={{
                  position: "absolute",
                  top: lane.yTop,
                  left: 0,
                  right: 0,
                  height: SWIMLANE_HEADER_HEIGHT,
                  background: "rgba(99,102,241,0.04)",
                  borderTop: "1px solid rgba(99,102,241,0.15)",
                  borderBottom: "1px solid rgba(99,102,241,0.08)",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Row stripes */}
            {layout.rows.map((row) => (
              <div
                key={"stripe-" + row.id}
                style={{
                  position: "absolute",
                  top: row.yTop,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  background: row.laneIndex % 2 === 0 ? "rgba(255,255,255,0.012)" : "transparent",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Gantt bars — duration from created_at (open) → completed_at (close) */}
            {layout.rows.map((row) => {
              const status = row.node.data.status;
              const type = row.node.data.type ?? row.node.data.role;
              const barColor = STATUS_COLORS[status] ?? "#475569";
              const borderColor = TYPE_COLORS[type] ?? "#475569";
              const isPinned = row.id === pinnedNodeId;
              const isHighlighted = row.id === searchHighlightId;

              // Duration fill: completed tickets show full solid bar (actual duration known).
              // In-progress: partial fill based on days elapsed vs bar width.
              // Queued/locked: empty fill — ticket hasn't started.
              const barDurationDays = row.barWidth / PX_PER_DAY;
              const elapsedDays =
                (Date.now() - new Date(row.startLabel).getTime()) /
                (1000 * 60 * 60 * 24);
              const fillPercent =
                status === "completed"
                  ? 100
                  : status === "in_progress"
                  ? Math.min(100, Math.max(10, Math.round((elapsedDays / barDurationDays) * 100)))
                  : 0;

              return (
                <div
                  key={row.id}
                  data-node="true"
                  onClick={() => setPinnedNode(isPinned ? null : row.id)}
                  title={`${row.node.data.label}\n${row.startLabel} → ${row.endLabel}\nStatus: ${status}`}
                  style={{
                    position: "absolute",
                    top: row.yTop + 8,
                    left: row.barLeft,
                    width: row.barWidth,
                    height: ROW_HEIGHT - 16,
                    borderRadius: 5,
                    background: isPinned
                      ? "rgba(99,102,241,0.2)"
                      : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${isPinned ? "#818cf8" : `${barColor}88`}`,
                    boxShadow: isHighlighted
                      ? `0 0 0 2px #f59e0b`
                      : isPinned
                      ? "0 0 0 2px rgba(129,140,248,0.5)"
                      : status === "in_progress"
                      ? `0 0 8px 1px ${barColor}44`
                      : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: 8,
                    paddingRight: 8,
                    overflow: "hidden",
                    zIndex: 2,
                    transition: "box-shadow 0.15s, border-color 0.15s",
                  }}
                >
                  {/* Duration fill — solid colour showing actual ticket duration */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${fillPercent}%`,
                      background:
                        status === "completed"
                          ? `linear-gradient(90deg, ${barColor}55 0%, ${barColor}88 100%)`
                          : status === "in_progress"
                          ? `linear-gradient(90deg, ${barColor}44 0%, ${barColor}66 100%)`
                          : `${barColor}22`,
                      borderRadius: fillPercent === 100 ? 4 : "4px 0 0 4px",
                      pointerEvents: "none",
                      transition: "width 0.5s ease",
                    }}
                  />
                  {/* Label inside bar */}
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#e2e8f0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {row.node.data.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
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
        Click bar to pin details · Drag to pan · / to search
      </div>

      {/* Empty state */}
      {layout.rows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-slate-600">
            <div className="text-2xl mb-2">📅</div>
            <div className="font-mono text-sm">No nodes yet</div>
            <div className="font-mono text-xs mt-1 text-slate-700">Add nodes with start/due dates to see the Gantt chart</div>
          </div>
        </div>
      )}
    </div>
  );
}
