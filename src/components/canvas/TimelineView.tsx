"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTreeStore } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import type { Node3D } from "@/lib/store/tree-store";
import type { ViewConfig } from "@/types/skill-tree";
import { getNodeProperty, isCardType } from "@/types/skill-tree";
import { sfxPanelOpen } from "@/lib/sfx";
import { FilterBar } from "@/components/canvas/FilterBar";

type Filter = NonNullable<ViewConfig["filters"]>[number];

const STATUS_ICON: Record<string, string> = {
  completed:   "✅",
  in_progress: "⚡",
  queued:      "⏳",
  backlog:     "📋",
};

const STATUS_COLOR: Record<string, string> = {
  completed:   "#22c55e",
  in_progress: "#f59e0b",
  queued:      "#6366f1",
  backlog:     "#475569",
};

function formatDate(ts: string | undefined | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getNodeDate(node: Node3D, dateField?: string): string | null {
  // If a date_field is specified in view config, read from properties
  if (dateField) {
    const val = getNodeProperty(node.data, dateField);
    if (val) return String(val);
  }
  // Fallback: use completed_at for completed nodes
  const props = (node.data.properties ?? {}) as Record<string, unknown>;
  if ((props.status as string) === "completed") {
    return (props.completed_at ?? props.created_at ?? null) as string | null;
  }
  return null;
}

function getDateKey(ts: string | null): string {
  if (!ts) return "Pending";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "Pending";
  return d.toISOString().slice(0, 10);
}

interface PhaseGroup {
  phaseKey: string;
  phaseLabel: string;
  color: string;
  nodes: Node3D[];
}

interface TimelineGroup {
  dateKey: string;
  dateLabel: string;
  phases: PhaseGroup[];
}

// Lazy-rendered ticket card: shows a placeholder when outside the viewport,
// switches to full content once intersected (and stays rendered).
function LazyTicketCard({
  node,
  pinnedNodeId,
  flashNodeIds,
  setPinnedNode,
}: {
  node: Node3D;
  pinnedNodeId: string | null;
  flashNodeIds: Set<string>;
  setPinnedNode: (id: string | null) => void;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isPinned = node.id === pinnedNodeId;
  const isFlashing = flashNodeIds.has(node.id);
  const status = String(getNodeProperty(node.data, "status") ?? "backlog");
  const color = STATUS_COLOR[status] ?? "#475569";
  const icon = STATUS_ICON[status] ?? "📋";
  const props = (node.data.properties ?? {}) as Record<string, unknown>;
  const itemId = props.item_id as string | undefined;
  const commitHash = props.commit_hash as string | undefined;

  if (!visible) {
    return (
      <div
        ref={ref}
        style={{
          minHeight: 80,
          borderRadius: 4,
          background: "rgba(255,255,255,0.01)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      />
    );
  }

  return (
    <div
      ref={ref}
      onClick={() => {
        if (!isPinned) sfxPanelOpen();
        setPinnedNode(isPinned ? null : node.id);
      }}
      style={{
        background: isFlashing ? `${color}1a` : isPinned ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
        borderTop: `1px solid ${isPinned || isFlashing ? color : "rgba(255,255,255,0.07)"}`,
        borderRight: `1px solid ${isPinned || isFlashing ? color : "rgba(255,255,255,0.07)"}`,
        borderBottom: `1px solid ${isPinned || isFlashing ? color : "rgba(255,255,255,0.07)"}`,
        borderLeft: `1px solid ${isPinned || isFlashing ? color : "rgba(255,255,255,0.07)"}`,
        borderRadius: 4, padding: "10px 10px 8px",
        cursor: "pointer", transition: isFlashing ? "all 0.3s" : "all 0.12s",
        boxShadow: isFlashing ? `0 0 10px ${color}55` : isPinned ? `0 0 12px ${color}33` : "none",
      }}
      onMouseEnter={(e) => {
        if (!isPinned && !isFlashing) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!isPinned && !isFlashing) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
      }}
    >
      {/* ID */}
      <div style={{ fontFamily: "monospace", fontSize: 9, color: "#475569", marginBottom: 3 }}>
        {itemId ?? node.id.toUpperCase()}
      </div>
      {/* Title */}
      <div style={{
        fontFamily: "monospace", fontSize: 10, fontWeight: 600,
        color: "#cbd5e1", lineHeight: 1.4, marginBottom: 6,
        display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {node.data.label.replace(/^ITEM-\d+:\s*/, "")}
      </div>
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: color, fontFamily: "monospace", fontWeight: 600 }}>
          {icon} {status.replace(/_/g, " ").toUpperCase()}
        </span>
        {commitHash && (
          <span style={{ fontFamily: "monospace", fontSize: 8, color: "#334155" }}>
            {commitHash.slice(0, 6)}
          </span>
        )}
      </div>
    </div>
  );
}

export function TimelineView({ viewConfig }: { viewConfig?: ViewConfig } = {}) {
  const dateField = viewConfig?.date_field;
  const nodes = useTreeStore((s) => s.nodes);
  const treeSchema = useTreeStore((s) => s.treeSchema);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const [filters, setFilters] = useState<Filter[]>(viewConfig?.filters ?? []);
  const [showOlderDates, setShowOlderDates] = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  // Flash animation: track recently updated node IDs
  const [flashNodeIds, setFlashNodeIds] = useState<Set<string>>(new Set());
  const prevNodesRef = useRef<Map<string, string>>(new Map());

  // Detect node status changes and trigger flash animation
  useEffect(() => {
    const prev = prevNodesRef.current;
    const updated: string[] = [];
    for (const node of nodes) {
      const prevStatus = prev.get(node.id);
      const curStatus = (node.data.properties?.status as string) ?? "backlog";
      if (prevStatus !== undefined && prevStatus !== curStatus) {
        updated.push(node.id);
      }
      prev.set(node.id, curStatus);
    }
    if (updated.length > 0) {
      setFlashNodeIds((cur) => {
        const next = new Set(cur);
        for (const id of updated) next.add(id);
        return next;
      });
      const timer = setTimeout(() => {
        setFlashNodeIds((cur) => {
          const next = new Set(cur);
          for (const id of updated) next.delete(id);
          return next;
        });
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [nodes]);

  const pinnedNode = useMemo(
    () => nodes.find((n) => n.id === pinnedNodeId) ?? null,
    [nodes, pinnedNodeId]
  );

  // Only planet/satellite nodes (tickets)
  const tickets = useMemo(() =>
    nodes.filter((n) => isCardType(treeSchema ?? { properties: {} }, (n.data.type) as string)),
    [nodes, treeSchema]
  );

  // Apply filters
  const filtered = useMemo(() => {
    if (filters.length === 0) return tickets;
    return tickets.filter((n) => {
      for (const f of filters) {
        const val = getNodeProperty(n.data, f.property);
        if (f.operator === "in") {
          const allowed = f.value as string[];
          if (!allowed.includes(String(val ?? ""))) return false;
        } else if (f.operator === "contains") {
          if (!String(val ?? "").toLowerCase().includes(String(f.value).toLowerCase())) return false;
        } else if (f.operator === "between") {
          const range = f.value as { from?: string; to?: string };
          const dateStr = String(val ?? "");
          if (range.from && dateStr < range.from) return false;
          if (range.to && dateStr > range.to) return false;
        }
      }
      return true;
    });
  }, [tickets, filters]);

  // Group by date
  const groups = useMemo((): TimelineGroup[] => {
    const map = new Map<string, Node3D[]>();

    filtered.forEach((n) => {
      const dateKey = getDateKey(getNodeDate(n, dateField));
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(n);
    });

    // Sort groups: dated ones chronologically, "Pending" at end
    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Pending") return 1;
      if (b === "Pending") return -1;
      return a.localeCompare(b);
    });

    const PHASE_COLORS = ["#6366f1","#22d3ee","#f59e0b","#a78bfa","#34d399","#f87171","#60a5fa","#fb923c"];

    return entries.map(([dateKey, groupNodes]) => {
      const phaseMap = new Map<string, Node3D[]>();
      groupNodes.forEach((n) => {
        const props = (n.data.properties ?? {}) as Record<string, unknown>;
        const phaseNum = props.phase as number | undefined;
        const phaseKey = phaseNum ? String(phaseNum) : "other";
        if (!phaseMap.has(phaseKey)) phaseMap.set(phaseKey, []);
        phaseMap.get(phaseKey)!.push(n);
      });

      const phaseEntries = Array.from(phaseMap.entries()).sort(([a], [b]) => {
        if (a === "other") return 1;
        if (b === "other") return -1;
        return parseInt(a) - parseInt(b);
      });

      const phases: PhaseGroup[] = phaseEntries.map(([phaseKey, phaseNodes], pi) => {
        const firstNode = phaseNodes[0];
        const props = (firstNode.data.properties ?? {}) as Record<string, unknown>;
        const phaseNum = props.phase as number | undefined;
        const phaseName = props.phase_name as string | undefined;
        return {
          phaseKey,
          phaseLabel: phaseName ? `Phase ${phaseNum} · ${phaseName}` : phaseNum ? `Phase ${phaseNum}` : "Other",
          color: PHASE_COLORS[pi % PHASE_COLORS.length],
          nodes: phaseNodes.sort((a, b) => ((a.data.properties?.priority as number) ?? 99) - ((b.data.properties?.priority as number) ?? 99)),
        };
      });

      return {
        dateKey,
        dateLabel: dateKey === "Pending" ? "Pending / Not started" : formatDate(dateKey + "T00:00:00Z"),
        phases,
      };
    });
  }, [filtered, dateField]);

  // 90-day window: show last 90 days + all Pending; older dates load on demand
  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }, []);

  const { visibleGroups, hasOlderGroups } = useMemo(() => {
    if (showOlderDates) return { visibleGroups: groups, hasOlderGroups: false };
    const visible: TimelineGroup[] = [];
    let hasOlder = false;
    for (const g of groups) {
      if (g.dateKey === "Pending" || g.dateKey >= cutoffDate) {
        visible.push(g);
      } else {
        hasOlder = true;
      }
    }
    return { visibleGroups: visible, hasOlderGroups: hasOlder };
  }, [groups, showOlderDates, cutoffDate]);

  const togglePhaseCollapse = (dateKey: string, phaseKey: string) => {
    const key = `${dateKey}:${phaseKey}`;
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const completedCount = tickets.filter((n) => (n.data.properties?.status as string) === "completed").length;
  const total = tickets.length;

  return (
    <div
      style={{
        width: "100%", height: "100%", overflowY: "auto", overflowX: "hidden",
        background: "#080b14", position: "relative",
      }}
    >
      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(8,11,20,0.95)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 24px", display: "flex", alignItems: "center", gap: 16,
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#22c55e", fontWeight: 700 }}>
          {completedCount}/{total} DONE
        </span>
        {/* Progress bar */}
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, maxWidth: 200 }}>
          <div style={{
            height: "100%", borderRadius: 2, background: "#22c55e",
            width: `${total > 0 ? (completedCount / total) * 100 : 0}%`,
            transition: "width 0.5s",
          }} />
        </div>
        {/* FilterBar */}
        {treeSchema && (
          <div style={{ marginLeft: "auto" }}>
            <FilterBar
              schema={treeSchema}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ padding: "24px 32px 24px 72px", position: "relative" }}>
        {/* Vertical line */}
        <div style={{
          position: "absolute", left: 44, top: 0, bottom: 0,
          width: 1, background: "rgba(255,255,255,0.04)",
        }} />

        {/* Load older button — shown when older data exists and hasn't been loaded */}
        {hasOlderGroups && (
          <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => setShowOlderDates(true)}
              style={{
                fontFamily: "monospace", fontSize: 10,
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: 20, padding: "5px 16px",
                color: "#818cf8", cursor: "pointer",
                letterSpacing: "0.06em", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.06)")}
            >
              ↑ Load older dates
            </button>
          </div>
        )}

        {visibleGroups.map((group) => (
          <div key={group.dateKey} style={{ marginBottom: 40, position: "relative" }}>
            {/* Date marker */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, position: "relative" }}>
              {/* Dot on timeline */}
              <div style={{
                position: "absolute", left: -28,
                width: 10, height: 10, borderRadius: "50%",
                background: group.dateKey === "Pending" ? "#334155" : "#22c55e",
                border: `2px solid ${group.dateKey === "Pending" ? "#475569" : "#4ade80"}`,
                boxShadow: group.dateKey !== "Pending" ? "0 0 8px #22c55e88" : "none",
              }} />
              <span style={{
                fontFamily: "monospace", fontSize: 11, color: "#94a3b8",
                fontWeight: 600, letterSpacing: "0.05em",
              }}>
                {group.dateLabel}
              </span>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "#334155" }}>
                — {group.phases.reduce((sum, p) => sum + p.nodes.length, 0)} ticket{group.phases.reduce((sum, p) => sum + p.nodes.length, 0) !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Phase sub-groups */}
            {group.phases.map((phaseGroup) => {
              const collapseKey = `${group.dateKey}:${phaseGroup.phaseKey}`;
              const isCollapsed = collapsedPhases.has(collapseKey);
              return (
                <div key={phaseGroup.phaseKey} style={{ marginBottom: 16 }}>
                  {/* Phase label — clickable to collapse/expand */}
                  <div
                    onClick={() => togglePhaseCollapse(group.dateKey, phaseGroup.phaseKey)}
                    style={{
                      fontFamily: "monospace", fontSize: 9, color: phaseGroup.color,
                      textTransform: "uppercase", letterSpacing: "0.1em",
                      marginBottom: isCollapsed ? 0 : 8,
                      display: "flex", alignItems: "center", gap: 6,
                      cursor: "pointer", userSelect: "none",
                    }}
                  >
                    <div style={{ width: 8, height: 2, background: phaseGroup.color, borderRadius: 1 }} />
                    {phaseGroup.phaseLabel}
                    <span style={{ color: "#334155" }}>({phaseGroup.nodes.length})</span>
                    <span style={{ color: "#475569", fontSize: 8, marginLeft: 2 }}>
                      {isCollapsed ? "▶" : "▼"}
                    </span>
                  </div>

                  {/* Ticket grid — hidden when phase is collapsed */}
                  {!isCollapsed && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                      gap: 8,
                    }}>
                      {phaseGroup.nodes.map((node) => (
                        <LazyTicketCard
                          key={node.id}
                          node={node}
                          pinnedNodeId={pinnedNodeId}
                          flashNodeIds={flashNodeIds}
                          setPinnedNode={setPinnedNode}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {visibleGroups.length === 0 && (
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", textAlign: "center", marginTop: 80 }}>
            No tickets match the current filter.
          </div>
        )}
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
    </div>
  );
}
