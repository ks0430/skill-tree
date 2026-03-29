/**
 * Gantt layout engine
 *
 * Maps SkillNode data (from Node3D) to horizontal time-bar positions.
 *
 * Date priority (highest to lowest):
 *   start: properties.created_at → properties.start_date → relative ordering
 *   end:   properties.completed_at → properties.due_date → start + estimate → start + 7d
 *
 * Swimlane mode: rows are grouped by `properties.assignee`.  Each group gets a
 * labelled header band; tickets in each group are rendered in their own row.
 */

import type { Node3D } from "@/lib/store/tree-store";

/** Pixel width per day when rendering Gantt bars. */
export const PX_PER_DAY = 24;

/** Minimum bar width in pixels (nodes without a known duration). */
export const MIN_BAR_WIDTH = 48;

/** Row height in pixels. */
export const ROW_HEIGHT = 44;

/** Left offset (label column width) in pixels. */
export const LABEL_COL_WIDTH = 200;

/** Padding between rows (gap). */
export const ROW_GAP = 8;

/** Height of a swimlane header band. */
export const SWIMLANE_HEADER_HEIGHT = 30;

/** Gap below a swimlane header before the first row. */
export const SWIMLANE_HEADER_GAP = 4;

export interface GanttRow {
  id: string;
  node: Node3D;
  /** Pixel offset from the time-axis origin (x = 0 → epoch). */
  barLeft: number;
  /** Pixel width of the bar. */
  barWidth: number;
  /** ISO date string for bar start (display only). */
  startLabel: string;
  /** ISO date string for bar end (display only). */
  endLabel: string;
  /**
   * Absolute pixel y-offset (from top of the scrollable rows area).
   * Use directly instead of deriving from rowIndex.
   */
  yTop: number;
  /** Row index within its swimlane (0-based), kept for stripe-coloring. */
  laneIndex: number;
}

export interface GanttSwimlaneHeader {
  agentName: string;
  /** Absolute pixel y-offset for the header band. */
  yTop: number;
  /** Number of ticket rows in this swimlane. */
  rowCount: number;
}

export interface GanttLayout {
  rows: GanttRow[];
  swimlaneHeaders: GanttSwimlaneHeader[];
  /** Earliest date represented in the layout (epoch for x = 0). */
  epochDate: Date;
  /** Total pixel width of the time area. */
  totalWidth: number;
  /** Total pixel height (all rows + swimlane headers). */
  totalHeight: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse an estimate string like "3d", "2w", "1m" into days. */
function parseEstimateDays(s: string | null | undefined): number | null {
  if (!s) return null;
  const trimmed = s.trim().toLowerCase();
  const numMatch = trimmed.match(/^(\d+(\.\d+)?)\s*([dwmh])?/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  const unit = numMatch[3] ?? "d";
  switch (unit) {
    case "h": return Math.ceil(num / 8);   // hours → business days (8h)
    case "d": return Math.ceil(num);
    case "w": return Math.ceil(num * 7);
    case "m": return Math.ceil(num * 30);
    default:  return Math.ceil(num);
  }
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Main layout function ──────────────────────────────────────────────────────

interface Parsed {
  node: Node3D;
  start: Date | null;
  end: Date | null;
  durationDays: number | null;
  agentName: string;
}

/**
 * Compute a swimlane Gantt layout from a list of Node3D items.
 *
 * Strategy:
 * 1. Extract assignee from `properties.assignee`; nodes without one go into "Unassigned".
 * 2. Extract start/end from properties (start_date, due_date, estimate).
 * 3. Group into swimlanes sorted: named agents alphabetically, then "Unassigned".
 * 4. Within each swimlane, sort by start date (undated nodes last).
 * 5. The epoch (x = 0) is the minimum start date across all nodes (floored to
 *    month start for a tidy axis), or today if none exist.
 */
export function computeGanttLayout(nodes: Node3D[]): GanttLayout {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse dates + assignee for each node
  const parsed: Parsed[] = nodes.map((n) => {
    const p = (n.data.properties ?? {}) as Record<string, string | null>;
    // Prefer created_at (ticket open time) over manual start_date
    const start = parseDate(p.created_at) ?? parseDate(p.start_date);
    // Prefer completed_at (ticket close time) over manual due_date
    const end = parseDate(p.completed_at) ?? parseDate(p.due_date);
    const estDays = parseEstimateDays(p.estimate);

    let resolvedEnd = end;
    if (!resolvedEnd && start && estDays) {
      resolvedEnd = addDays(start, estDays);
    }

    let resolvedStart = start;
    if (!resolvedStart && resolvedEnd && estDays) {
      resolvedStart = addDays(resolvedEnd, -estDays);
    }

    const duration =
      resolvedStart && resolvedEnd
        ? Math.max(1, Math.ceil(daysBetween(resolvedStart, resolvedEnd)))
        : estDays ?? null;

    const agentName =
      typeof p.assignee === "string" && p.assignee.trim() !== ""
        ? p.assignee.trim()
        : "Unassigned";

    return { node: n, start: resolvedStart, end: resolvedEnd, durationDays: duration, agentName };
  });

  // Determine epoch
  const datedNodes = parsed.filter((p) => p.start !== null);
  let epochDate: Date;
  if (datedNodes.length > 0) {
    const minStart = datedNodes.reduce<Date>((min, p) => {
      return p.start! < min ? p.start! : min;
    }, datedNodes[0].start!);
    epochDate = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
  } else {
    epochDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  // Group by agentName
  const groupMap = new Map<string, Parsed[]>();
  for (const p of parsed) {
    const existing = groupMap.get(p.agentName) ?? [];
    existing.push(p);
    groupMap.set(p.agentName, existing);
  }

  // Sort group names: named agents alphabetically first, "Unassigned" last
  const agentNames = [...groupMap.keys()].sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });

  // Compute undated cursor baseline (for cross-group sequential placement)
  const lastDatedEnd = datedNodes.reduce<Date>((max, p) => {
    const e = p.end ?? (p.start ? addDays(p.start, p.durationDays ?? 7) : today);
    return e > max ? e : max;
  }, epochDate);
  const undatedStart = addDays(lastDatedEnd, 14);
  let undatedCursor = 0;

  // Build rows + swimlane headers
  const rows: GanttRow[] = [];
  const swimlaneHeaders: GanttSwimlaneHeader[] = [];

  let currentY = 0; // running y offset

  for (const agentName of agentNames) {
    const group = groupMap.get(agentName)!;

    // Sort within group: dated first (by start), undated last
    group.sort((a, b) => {
      if (a.start && b.start) return a.start.getTime() - b.start.getTime();
      if (a.start) return -1;
      if (b.start) return 1;
      return 0;
    });

    // Record swimlane header position
    swimlaneHeaders.push({
      agentName,
      yTop: currentY,
      rowCount: group.length,
    });
    currentY += SWIMLANE_HEADER_HEIGHT + SWIMLANE_HEADER_GAP;

    // Build rows for this swimlane
    group.forEach((p, laneIndex) => {
      let barStart: Date;
      let barDays: number;

      if (p.start) {
        barStart = p.start;
        barDays = p.durationDays ?? 7;
      } else {
        barStart = addDays(undatedStart, undatedCursor * 10);
        barDays = p.durationDays ?? 7;
        undatedCursor++;
      }

      const barEnd = p.end ?? addDays(barStart, barDays);
      const barLeft = Math.round(daysBetween(epochDate, barStart) * PX_PER_DAY);
      const barWidth = Math.max(MIN_BAR_WIDTH, Math.round(barDays * PX_PER_DAY));

      rows.push({
        id: p.node.id,
        node: p.node,
        barLeft,
        barWidth,
        startLabel: fmtDate(barStart),
        endLabel: fmtDate(barEnd),
        yTop: currentY + ROW_GAP,
        laneIndex,
      });

      currentY += ROW_HEIGHT + ROW_GAP;
    });

    // Extra gap after each swimlane (except the last)
    currentY += ROW_GAP * 2;
  }

  const totalHeight = currentY;
  const maxRight = rows.reduce((m, r) => Math.max(m, r.barLeft + r.barWidth), 0);
  const totalWidth = Math.max(maxRight + LABEL_COL_WIDTH + 200, 1200);

  return { rows, swimlaneHeaders, epochDate, totalWidth, totalHeight };
}

// ─── Axis tick generation ──────────────────────────────────────────────────────

export interface AxisTick {
  label: string;
  x: number; // pixel offset from epoch
}

/**
 * Generate monthly axis ticks for the given layout.
 */
export function generateMonthTicks(layout: GanttLayout): AxisTick[] {
  const ticks: AxisTick[] = [];
  const { epochDate, totalWidth } = layout;

  let cursor = new Date(epochDate);
  while (true) {
    const x = Math.round(daysBetween(epochDate, cursor) * PX_PER_DAY);
    if (x > totalWidth) break;

    const label = cursor.toLocaleString("default", { month: "short", year: "numeric" });
    ticks.push({ label, x });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return ticks;
}
