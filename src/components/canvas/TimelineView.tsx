"use client";

import { useMemo, useState } from "react";
import { useTreeStore } from "@/lib/store/tree-store";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import type { Node3D } from "@/lib/store/tree-store";
import { sfxPanelOpen } from "@/lib/sfx";

const STATUS_ICON: Record<string, string> = {
  completed:   "✅",
  in_progress: "⚡",
  queued:      "⏳",
  locked:      "🔒",
};

const STATUS_COLOR: Record<string, string> = {
  completed:   "#22c55e",
  in_progress: "#f59e0b",
  queued:      "#6366f1",
  locked:      "#475569",
};

function formatDate(ts: string | undefined | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getNodeDate(node: Node3D): string | null {
  const props = (node.data.properties ?? {}) as Record<string, unknown>;
  // For completed nodes: use completed_at, then created_at
  if (node.data.status === "completed") {
    return (props.completed_at ?? props.created_at ?? null) as string | null;
  }
  // For non-completed: no date → goes to Pending
  return null;
}

function getDateKey(ts: string | null): string {
  if (!ts) return "Pending";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "Pending";
  return d.toISOString().slice(0, 10);
}

function getPhaseName(node: Node3D): string {
  const props = (node.data.properties ?? {}) as Record<string, unknown>;
  const name = props.phase_name as string | undefined;
  const num = props.phase as number | undefined;
  if (name) return num ? `Phase ${num} · ${name}` : name;
  return "";
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

export function TimelineView() {
  const nodes = useTreeStore((s) => s.nodes);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");

  const pinnedNode = useMemo(
    () => nodes.find((n) => n.id === pinnedNodeId) ?? null,
    [nodes, pinnedNodeId]
  );

  // Only planet nodes (tickets)
  const tickets = useMemo(() =>
    nodes.filter((n) => (n.data.type ?? n.data.role) !== "stellar"),
    [nodes]
  );

  // Apply filter
  const filtered = useMemo(() => {
    if (filter === "completed") return tickets.filter((n) => n.data.status === "completed");
    if (filter === "pending") return tickets.filter((n) => n.data.status !== "completed");
    return tickets;
  }, [tickets, filter]);

  // Group by date
  const groups = useMemo((): TimelineGroup[] => {
    const map = new Map<string, Node3D[]>();

    filtered.forEach((n) => {
      const dateKey = getDateKey(getNodeDate(n));
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(n);
    });

    // Sort groups: dated ones chronologically, "Pending" at end
    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Pending") return 1;
      if (b === "Pending") return -1;
      return a.localeCompare(b);
    });

    // Phase colors for sub-groups
    const PHASE_COLORS = ["#6366f1","#22d3ee","#f59e0b","#a78bfa","#34d399","#f87171","#60a5fa","#fb923c"];

    return entries.map(([dateKey, groupNodes]) => {
      // Sub-group by phase within each date
      const phaseMap = new Map<string, Node3D[]>();
      groupNodes.forEach((n) => {
        const props = (n.data.properties ?? {}) as Record<string, unknown>;
        const phaseNum = props.phase as number | undefined;
        const phaseName = props.phase_name as string | undefined;
        const phaseKey = phaseNum ? String(phaseNum) : "other";
        const phaseLabel = phaseName ? `Phase ${phaseNum} · ${phaseName}` : phaseNum ? `Phase ${phaseNum}` : "Other";
        if (!phaseMap.has(phaseKey)) phaseMap.set(phaseKey, []);
        phaseMap.get(phaseKey)!.push(n);
        // store label alongside (hack: prefix key with label)
        (phaseMap as Map<string, Node3D[] & { _label?: string }>).get(phaseKey)!;
      });

      // Sort phases numerically
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
          nodes: phaseNodes.sort((a, b) => (a.data.priority ?? 99) - (b.data.priority ?? 99)),
        };
      });

      return {
        dateKey,
        dateLabel: dateKey === "Pending" ? "Pending / Not started" : formatDate(dateKey + "T00:00:00Z"),
        phases,
      };
    });
  }, [filtered]);

  const completedCount = tickets.filter((n) => n.data.status === "completed").length;
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
        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {(["all", "completed", "pending"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: "monospace", fontSize: 9, padding: "3px 10px", borderRadius: 20,
              border: `1px solid ${filter === f ? "rgba(129,140,248,0.6)" : "rgba(255,255,255,0.08)"}`,
              background: filter === f ? "rgba(129,140,248,0.12)" : "transparent",
              color: filter === f ? "#a5b4fc" : "#475569", cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.1em",
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: "24px 24px 24px 40px", position: "relative" }}>
        {/* Vertical line */}
        <div style={{
          position: "absolute", left: 52, top: 0, bottom: 0,
          width: 1, background: "rgba(255,255,255,0.06)",
        }} />

        {groups.map((group, gi) => (
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
            {group.phases.map((phaseGroup) => (
              <div key={phaseGroup.phaseKey} style={{ marginBottom: 16 }}>
                {/* Phase label */}
                <div style={{
                  fontFamily: "monospace", fontSize: 9, color: phaseGroup.color,
                  textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <div style={{ width: 8, height: 2, background: phaseGroup.color, borderRadius: 1 }} />
                  {phaseGroup.phaseLabel}
                  <span style={{ color: "#334155" }}>({phaseGroup.nodes.length})</span>
                </div>

                {/* Ticket grid */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                  gap: 8,
                }}>
                  {phaseGroup.nodes.map((node) => {
                const isPinned = node.id === pinnedNodeId;
                const color = STATUS_COLOR[node.data.status] ?? "#475569";
                const icon = STATUS_ICON[node.data.status] ?? "🔒";
                const phaseName = getPhaseName(node);
                const props = (node.data.properties ?? {}) as Record<string, unknown>;
                const itemId = props.item_id as string | undefined;
                const commitHash = props.commit_hash as string | undefined;

                return (
                  <div
                    key={node.id}
                    onClick={() => {
                      if (!isPinned) sfxPanelOpen();
                      setPinnedNode(isPinned ? null : node.id);
                    }}
                    style={{
                      background: isPinned ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                      borderTop: `1px solid ${isPinned ? color : "rgba(255,255,255,0.07)"}`,
                      borderRight: `1px solid ${isPinned ? color : "rgba(255,255,255,0.07)"}`,
                      borderBottom: `1px solid ${isPinned ? color : "rgba(255,255,255,0.07)"}`,
                      borderLeft: `1px solid ${isPinned ? color : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 4, padding: "10px 10px 8px",
                      cursor: "pointer", transition: "all 0.12s",
                      boxShadow: isPinned ? `0 0 12px ${color}33` : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isPinned) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isPinned) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
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
                        {icon} {node.data.status.replace("_", " ").toUpperCase()}
                      </span>
                      {commitHash && (
                        <span style={{ fontFamily: "monospace", fontSize: 8, color: "#334155" }}>
                          {commitHash.slice(0, 6)}
                        </span>
                      )}
                    </div>
                  </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}

        {groups.length === 0 && (
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
