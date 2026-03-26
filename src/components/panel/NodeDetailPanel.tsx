"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Node3D } from "@/lib/store/tree-store";
import { useTreeStore } from "@/lib/store/tree-store";
import type { NodeContent } from "@/types/node-content";
import type { NodeStatus } from "@/types/skill-tree";
import {
  parseContent,
  getChecklist,
  toggleItem,
  addItem,
  removeItem,
  upsertChecklist,
} from "@/lib/content/checklist";
import { PanelHeader } from "./PanelHeader";
import { PanelDates } from "./PanelDates";
import { PanelRelations } from "./PanelRelations";
import { RichTextRenderer } from "./RichTextRenderer";
import { NotionBlockEditor } from "./NotionBlockEditor";
import { PanelHistory } from "./PanelHistory";

// ── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  icon: string;
  border: string;
  glow: string;
  barClass: string;
  labelClass: string;
}

const STATUS_CONFIG: Record<NodeStatus, StatusConfig> = {
  locked: {
    label: "Locked",
    icon: "🔒",
    border: "1px solid rgba(100,116,139,0.6)",          // slate
    glow: "0 0 0 1px rgba(100,116,139,0.3), 0 0 12px rgba(100,116,139,0.15)",
    barClass: "w-0",
    labelClass: "text-slate-400",
  },
  queued: {
    label: "Queued",
    icon: "⏳",
    border: "1px solid rgba(59,130,246,0.7)",            // blue
    glow: "0 0 0 1px rgba(59,130,246,0.25), 0 0 16px rgba(59,130,246,0.3), 0 0 32px rgba(59,130,246,0.1)",
    barClass: "w-1/4",
    labelClass: "text-blue-400",
  },
  in_progress: {
    label: "In Progress",
    icon: "⚡",
    border: "1px solid rgba(245,158,11,0.7)",            // amber
    glow: "0 0 0 1px rgba(245,158,11,0.25), 0 0 16px rgba(245,158,11,0.3), 0 0 32px rgba(245,158,11,0.1)",
    barClass: "w-1/2",
    labelClass: "text-amber-400",
  },
  completed: {
    label: "Completed",
    icon: "✅",
    border: "1px solid rgba(34,197,94,0.7)",             // green
    glow: "0 0 0 1px rgba(34,197,94,0.25), 0 0 16px rgba(34,197,94,0.3), 0 0 32px rgba(34,197,94,0.1)",
    barClass: "w-full",
    labelClass: "text-green-400",
  },
};

// ── Pulse animation keyframes injected once ──────────────────────────────────

const PULSE_STATUSES: NodeStatus[] = ["queued", "in_progress"];

function usePanelGlow(status: NodeStatus) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!PULSE_STATUSES.includes(status)) return;
    const id = setInterval(() => setFrame((f) => f + 1), 1200);
    return () => clearInterval(id);
  }, [status]);

  if (!PULSE_STATUSES.includes(status)) {
    return { border: cfg.border, boxShadow: cfg.glow };
  }
  // simple opacity pulse between 0.5x and 1x glow
  const intensity = 0.6 + 0.4 * Math.sin((frame / 2) * Math.PI);
  const baseGlow = cfg.glow.replace(/[\d.]+\)/g, (m) => {
    const n = parseFloat(m);
    return `${(n * intensity).toFixed(2)})`;
  });
  return { border: cfg.border, boxShadow: baseGlow };
}

// ── Draggable hook ───────────────────────────────────────────────────────────

const STORAGE_KEY = "node-panel-pos";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function loadPos(): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePos(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function useDraggable(panelW: number, panelH: number) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const saved = loadPos();
    if (saved) return saved;
    return { x: 16, y: 16 };
  });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const nx = clamp(e.clientX - offset.current.x, 0, window.innerWidth - panelW);
    const ny = clamp(e.clientY - offset.current.y, 0, window.innerHeight - panelH);
    setPos({ x: nx, y: ny });
  }, [panelW, panelH]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = false;
      setPos((p) => {
        savePos(p);
        return p;
      });
    },
    []
  );

  return { pos, onPointerDown, onPointerMove, onPointerUp };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface NodeDetailPanelProps {
  node: Node3D;
  pinned?: boolean;
  onClose?: () => void;
  readOnly?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NodeDetailPanel({
  node,
  pinned = false,
  onClose,
  readOnly = false,
}: NodeDetailPanelProps) {
  const [content, setContent] = useState<NodeContent>(() =>
    parseContent(node.data.content ?? { blocks: [] })
  );
  const [aiLoading, setAiLoading] = useState(false);
  const supabase = createClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateNode = useTreeStore((s) => s.updateNode);
  const props = (node.data.properties ?? {}) as Record<string, string | null>;
  const status: NodeStatus = node.data.status as NodeStatus;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.locked;

  // ── glow + drag ──────────────────────────────────────────────────────────
  const glowStyle = usePanelGlow(status);
  const PANEL_W = 380;
  const PANEL_H = 560;
  const { pos, onPointerDown, onPointerMove, onPointerUp } = useDraggable(PANEL_W, PANEL_H);

  // ── DB helpers ───────────────────────────────────────────────────────────
  const handleDateChange = useCallback(
    async (field: "due_date" | "start_date" | "estimate", value: string | null) => {
      const next = { ...props, [field]: value };
      updateNode(node.id, { properties: next });
      await supabase
        .from("skill_nodes")
        .update({ properties: next })
        .eq("id", node.id)
        .eq("tree_id", node.data.tree_id);
    },
    [props, node.id, node.data.tree_id, supabase, updateNode]
  );

  const writeToDb = useCallback(
    async (next: NodeContent) => {
      await supabase
        .from("skill_nodes")
        .update({ content: next })
        .eq("id", node.id)
        .eq("tree_id", node.data.tree_id);
    },
    [node.id, node.data.tree_id, supabase]
  );

  const persist = useCallback(
    async (next: NodeContent) => {
      setContent(next);
      await writeToDb(next);
    },
    [writeToDb]
  );

  const handleToggle = useCallback(
    (itemId: string) => {
      const next = toggleItem(content, itemId);
      setContent(next);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => writeToDb(next), 500);
    },
    [content, writeToDb]
  );

  const handleAdd = useCallback(
    (text: string) => {
      persist(addItem(content, text));
    },
    [content, persist]
  );

  const handleRemove = useCallback(
    (itemId: string) => {
      persist(removeItem(content, itemId));
    },
    [content, persist]
  );

  const handleAiGenerate = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/node/${node.id}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: node.data.tree_id }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`AI request failed (${res.status}): ${body}`);
      }
      const { items } = await res.json();
      const existing = getChecklist(content)?.items ?? [];
      const next = upsertChecklist(content, [...existing, ...items]);
      persist(next);
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  }, [node.id, content, persist]);

  const handleBlocksUpdate = useCallback(
    async (blocks: import("@/types/node-content").ContentBlock[]) => {
      const next: NodeContent = { ...content, blocks };
      persist(next);
    },
    [content, persist]
  );

  const handleLabelUpdate = useCallback(
    async (newLabel: string) => {
      updateNode(node.id, { label: newLabel });
      await supabase
        .from("skill_nodes")
        .update({ label: newLabel })
        .eq("id", node.id)
        .eq("tree_id", node.data.tree_id);
    },
    [node.id, node.data.tree_id, supabase, updateNode]
  );

  // ── Stat grid data ───────────────────────────────────────────────────────
  const phase = props.phase ?? "—";
  const priority = props.priority ?? "—";
  const startDate = props.start_date ?? "—";
  const dueDate = props.due_date ?? "—";
  const estimate = props.estimate ?? "—";

  const statRows: [string, string][] = [
    ["Priority", priority],
    ["Phase", phase],
    ["Start", startDate !== "—" ? startDate.slice(0, 10) : "—"],
    ["Due", dueDate !== "—" ? dueDate.slice(0, 10) : "—"],
    ["Estimate", estimate],
    ["Status", statusCfg.label],
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  // Scanline overlay as inline CSS (no external assets needed)
  const scanlineStyle: React.CSSProperties = {
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px)",
  };

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: PANEL_W,
        minWidth: 320,
        maxWidth: 420,
        maxHeight: "calc(100vh - 2rem)",
        zIndex: 50,
        pointerEvents: pinned ? "auto" : "none",
        display: "flex",
        flexDirection: "column",
        borderRadius: 6,
        // semi-transparent dark background
        backgroundColor: "rgba(10, 12, 18, 0.92)",
        backdropFilter: "blur(8px)",
        border: glowStyle.border,
        boxShadow: glowStyle.boxShadow,
        // scanline texture overlay via pseudo — we'll use a wrapper div instead
      }}
    >
      {/* Scanline texture overlay (pointer-events:none so it doesn't block clicks) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 6,
          pointerEvents: "none",
          zIndex: 0,
          ...scanlineStyle,
        }}
      />

      {/* ── Header bar (drag handle) ───────────────────────────────────── */}
      <div
        className="flex-shrink-0 select-none cursor-grab active:cursor-grabbing"
        style={{
          position: "relative",
          zIndex: 1,
          backgroundColor: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "6px 6px 0 0",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Title */}
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          <PanelHeader
            role={(node.data.type ?? node.data.role) as import("@/types/skill-tree").NodeRole}
            label={node.data.label}
            pinned={pinned}
            onClose={onClose}
            onLabelUpdate={!readOnly ? handleLabelUpdate : undefined}
          />
        </div>

        {/* Status badge — right side */}
        <div
          className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-mono font-semibold ${statusCfg.labelClass}`}
        >
          <span>{statusCfg.icon}</span>
          <span>{statusCfg.label.toUpperCase()}</span>
        </div>
      </div>

      {/* ── Stat grid ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "10px 14px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px 0",
        }}
      >
        {statRows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <span
              className="font-mono text-[10px] text-slate-500 uppercase tracking-wider w-14 flex-shrink-0"
            >
              {label}
            </span>
            <span
              className="font-mono text-[11px] text-slate-200 truncate"
              title={value}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Status progress bar ───────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-3 py-2"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div className="h-[2px] bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${statusCfg.barClass}`}
            style={{
              background:
                status === "completed"
                  ? "rgba(34,197,94,0.8)"
                  : status === "in_progress"
                  ? "rgba(245,158,11,0.8)"
                  : status === "queued"
                  ? "rgba(59,130,246,0.8)"
                  : "rgba(100,116,139,0.4)",
            }}
          />
        </div>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "8px 14px 14px",
        }}
      >
        {/* Date pickers (edit mode) */}
        {!readOnly && (
          <div className="mb-3">
            <PanelDates
              dueDate={props.due_date}
              startDate={props.start_date}
              estimate={props.estimate}
              readOnly={readOnly}
              onChange={handleDateChange}
            />
          </div>
        )}

        {/* Notion-style block editor */}
        <div className="mb-3">
          <NotionBlockEditor
            blocks={content.blocks}
            readOnly={readOnly}
            onUpdate={handleBlocksUpdate}
          />
        </div>

        {/* Checklist */}
        <RichTextRenderer
          blocks={content.blocks.filter((b) => b.type === "checklist")}
          checklistHandlers={
            !readOnly
              ? {
                  onToggle: handleToggle,
                  onAdd: handleAdd,
                  onRemove: handleRemove,
                  onAiGenerate: handleAiGenerate,
                  aiLoading,
                }
              : undefined
          }
        />

        {!readOnly && <PanelRelations nodeId={node.id} treeId={node.data.tree_id} />}

        <PanelHistory nodeId={node.id} treeId={node.data.tree_id} />
      </div>
    </motion.div>
  );
}
