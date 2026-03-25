/**
 * Gantt layout engine
 *
 * Maps SkillNode data (from Node3D) to horizontal time-bar positions.
 * Uses `properties.start_date`, `properties.due_date`, and `properties.estimate`
 * for positioning.  Falls back to relative ordering when dates are absent.
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
  /** Row index (0-based), used for y positioning. */
  rowIndex: number;
}

export interface GanttLayout {
  rows: GanttRow[];
  /** Earliest date represented in the layout (epoch for x = 0). */
  epochDate: Date;
  /** Total pixel width of the time area. */
  totalWidth: number;
  /** Total pixel height (all rows). */
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

/**
 * Compute a Gantt layout from a list of Node3D items.
 *
 * Strategy:
 * 1. Extract start/end from properties (start_date, due_date, estimate).
 * 2. Nodes without any date info are placed after all dated nodes using
 *    relative ordering (stacked at the end).
 * 3. The epoch (x = 0) is the minimum start date across all nodes (floored
 *    to month start for a tidy axis), or today if none exist.
 */
export function computeGanttLayout(nodes: Node3D[]): GanttLayout {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  interface Parsed {
    node: Node3D;
    start: Date | null;
    end: Date | null;
    durationDays: number | null;
  }

  // Parse dates for each node
  const parsed: Parsed[] = nodes.map((n) => {
    const p = (n.data.properties ?? {}) as Record<string, string | null>;
    const start = parseDate(p.start_date);
    const end = parseDate(p.due_date);
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

    return { node: n, start: resolvedStart, end: resolvedEnd, durationDays: duration };
  });

  // Determine epoch
  const datedNodes = parsed.filter((p) => p.start !== null);
  let epochDate: Date;
  if (datedNodes.length > 0) {
    const minStart = datedNodes.reduce<Date>((min, p) => {
      return p.start! < min ? p.start! : min;
    }, datedNodes[0].start!);
    // Floor to first of that month
    epochDate = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
  } else {
    // No dates at all — epoch = start of current month
    epochDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  // Sort: nodes with earlier start first; undated nodes last
  parsed.sort((a, b) => {
    if (a.start && b.start) return a.start.getTime() - b.start.getTime();
    if (a.start) return -1;
    if (b.start) return 1;
    return 0;
  });

  // Build rows
  // For undated nodes we stack them sequentially after the last dated node
  let undatedCursor = 0;
  const lastDatedEnd = datedNodes.reduce<Date>((max, p) => {
    const e = p.end ?? (p.start ? addDays(p.start, p.durationDays ?? 7) : today);
    return e > max ? e : max;
  }, epochDate);
  const undatedStart = addDays(lastDatedEnd, 14); // 2-week gap after dated content

  const rows: GanttRow[] = parsed.map((p, i) => {
    let barStart: Date;
    let barDays: number;

    if (p.start) {
      barStart = p.start;
      barDays = p.durationDays ?? 7;
    } else {
      // undated — place sequentially
      barStart = addDays(undatedStart, undatedCursor * 10);
      barDays = p.durationDays ?? 7;
      undatedCursor++;
    }

    const barEnd = p.end ?? addDays(barStart, barDays);

    const barLeft = Math.round(daysBetween(epochDate, barStart) * PX_PER_DAY);
    const barWidth = Math.max(MIN_BAR_WIDTH, Math.round(barDays * PX_PER_DAY));

    return {
      id: p.node.id,
      node: p.node,
      barLeft,
      barWidth,
      startLabel: fmtDate(barStart),
      endLabel: fmtDate(barEnd),
      rowIndex: i,
    };
  });

  const maxRight = rows.reduce((m, r) => Math.max(m, r.barLeft + r.barWidth), 0);
  const totalWidth = Math.max(maxRight + LABEL_COL_WIDTH + 200, 1200);
  const totalHeight = rows.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;

  return { rows, epochDate, totalWidth, totalHeight };
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
