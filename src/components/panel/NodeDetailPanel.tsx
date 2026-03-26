"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Node3D } from "@/lib/store/tree-store";
import { useTreeStore } from "@/lib/store/tree-store";
import type { NodeContent, ContentBlock } from "@/types/node-content";
import type { NodeStatus } from "@/types/skill-tree";
import {
  parseContent, getChecklist, toggleItem, addItem, removeItem, upsertChecklist,
} from "@/lib/content/checklist";
import { RichTextRenderer } from "./RichTextRenderer";
import { PanelHistory } from "./PanelHistory";
import { PanelRelations } from "./PanelRelations";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<NodeStatus, { label: string; icon: string; border: string; glow: string; color: string; bar: string }> = {
  locked:      { label: "LOCKED",      icon: "🔒", color: "#64748b", bar: "0%",   border: "rgba(100,116,139,0.5)", glow: "0 0 12px rgba(100,116,139,0.15)" },
  queued:      { label: "QUEUED",      icon: "⏳", color: "#3b82f6", bar: "25%",  border: "rgba(59,130,246,0.7)",  glow: "0 0 20px rgba(59,130,246,0.35)"  },
  in_progress: { label: "ACTIVE",      icon: "⚡", color: "#f59e0b", bar: "50%",  border: "rgba(245,158,11,0.7)", glow: "0 0 20px rgba(245,158,11,0.35)"  },
  completed:   { label: "COMPLETED",   icon: "✅", color: "#22c55e", bar: "100%", border: "rgba(34,197,94,0.7)",  glow: "0 0 20px rgba(34,197,94,0.35)"   },
};

// ── Draggable ─────────────────────────────────────────────────────────────────

function useDraggable() {
  const [pos, setPos] = useState(() => {
    try { const s = localStorage.getItem("panel-pos"); return s ? JSON.parse(s) : { x: 16, y: 16 }; }
    catch { return { x: 16, y: 16 }; }
  });
  const drag = useRef(false);
  const off = useRef({ x: 0, y: 0 });

  const onDown = useCallback((e: React.PointerEvent) => {
    drag.current = true;
    off.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = Math.max(0, Math.min(e.clientX - off.current.x, window.innerWidth - 340));
    const y = Math.max(0, Math.min(e.clientY - off.current.y, window.innerHeight - 100));
    setPos({ x, y });
  }, []);

  const onUp = useCallback(() => {
    drag.current = false;
    setPos((p: { x: number; y: number }) => { try { localStorage.setItem("panel-pos", JSON.stringify(p)); } catch {} return p; });
  }, []);

  return { pos, onDown, onMove, onUp };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NodeDetailPanel({ node, pinned = false, onClose, readOnly = false }: {
  node: Node3D; pinned?: boolean; onClose?: () => void; readOnly?: boolean;
}) {
  const [content, setContent] = useState<NodeContent>(() => parseContent(node.data.content ?? { blocks: [] }));
  const [aiLoading, setAiLoading] = useState(false);
  const [showRelations, setShowRelations] = useState(false);
  const [pulse, setPulse] = useState(0);
  const supabase = createClient();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateNode = useTreeStore((s) => s.updateNode);

  const status = (node.data.status ?? "locked") as NodeStatus;
  const cfg = STATUS[status] ?? STATUS.locked;
  const props = (node.data.properties ?? {}) as Record<string, string | null>;
  const { pos, onDown, onMove, onUp } = useDraggable();

  // Pulse glow for active statuses
  useEffect(() => {
    if (status !== "in_progress" && status !== "queued") return;
    const id = setInterval(() => setPulse(p => p + 1), 1000);
    return () => clearInterval(id);
  }, [status]);
  const glowOpacity = (status === "in_progress" || status === "queued")
    ? 0.5 + 0.5 * Math.sin((pulse / 2) * Math.PI) : 1;

  const writeToDb = useCallback(async (next: NodeContent) => {
    await supabase.from("skill_nodes").update({ content: next }).eq("id", node.id).eq("tree_id", node.data.tree_id);
  }, [node.id, node.data.tree_id, supabase]);

  const persist = useCallback(async (next: NodeContent) => { setContent(next); await writeToDb(next); }, [writeToDb]);
  const handleToggle = useCallback((id: string) => {
    const next = toggleItem(content, id); setContent(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => writeToDb(next), 500);
  }, [content, writeToDb]);
  const handleAdd = useCallback((text: string) => persist(addItem(content, text)), [content, persist]);
  const handleRemove = useCallback((id: string) => persist(removeItem(content, id)), [content, persist]);
  const handleAiGenerate = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/node/${node.id}/checklist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ treeId: node.data.tree_id }) });
      if (!res.ok) throw new Error("AI request failed");
      const { items } = await res.json();
      const existing = getChecklist(content)?.items ?? [];
      persist(upsertChecklist(content, [...existing, ...items]));
    } catch (e) { console.error(e); } finally { setAiLoading(false); }
  }, [node.id, content, persist]);

  const handleBlockUpdate = useCallback(async (blockId: string, newText: string) => {
    const next: NodeContent = { ...content, blocks: content.blocks.map(b => "text" in b && b.id === blockId ? { ...b, text: newText } : b) as ContentBlock[] };
    persist(next);
  }, [content, persist]);

  // Stat rows — no dates here, they're in props if set
  const stats: [string, string][] = [
    ["Phase", String(props.phase ?? "—")],
    ["Priority", String(props.priority ?? node.data.priority ?? "—")],
    ["Start", props.start_date ? props.start_date.slice(0, 10) : "—"],
    ["Due", props.due_date ? props.due_date.slice(0, 10) : "—"],
    ["Estimate", props.estimate ?? "—"],
    ["Commit", props.commit_hash ? props.commit_hash.slice(0, 8) : "—"],
  ].filter(([, v]) => v !== "—") as [string, string][];

  // View-only blocks (no checklist — checklist rendered separately)
  const textBlocks = content.blocks.filter(b => b.type !== "checklist");
  const hasList = content.blocks.some(b => b.type === "checklist");

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.12 }}
      style={{
        position: "fixed", left: pos.x, top: pos.y,
        width: 260, maxHeight: "calc(100vh - 2rem)",
        zIndex: 50, pointerEvents: pinned ? "auto" : "none",
        display: "flex", flexDirection: "column",
        borderRadius: 4,
        backgroundColor: "rgba(8, 11, 18, 0.95)",
        border: `1px solid ${cfg.border}`,
        boxShadow: `${cfg.glow.replace(/[\d.]+\)$/, `${glowOpacity.toFixed(2)})`)}`,
        // Scanline texture
        backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 4px)",
      }}
    >
      {/* ── HEADER (drag handle) ─────────────────────────────────────── */}
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
        style={{
          cursor: "grab", userSelect: "none", touchAction: "none",
          padding: "7px 10px 6px",
          borderBottom: `1px solid ${cfg.border}40`,
          backgroundColor: "rgba(255,255,255,0.03)",
          borderRadius: "4px 4px 0 0",
          flexShrink: 0,
        }}
      >
        {/* Role tag + close */}
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontFamily: "monospace", fontSize: 9, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.9 }}>
            {(node.data.type ?? node.data.role ?? "node").toUpperCase()}
          </span>
          <div className="flex items-center gap-2">
            {pinned && <span style={{ fontSize: 9, fontFamily: "monospace", color: "#64748b" }}>● PINNED</span>}
            {onClose && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ color: "#94a3b8", fontSize: 18, lineHeight: 1, background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, flexShrink: 0 }}
              >×</button>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.35 }}>
          {node.data.label}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-2 mt-2">
          <div style={{ flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: cfg.bar, backgroundColor: cfg.color, borderRadius: 2, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: cfg.color, fontWeight: 700, letterSpacing: "0.1em" }}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>

      {/* ── STAT GRID ─────────────────────────────────────────────────── */}
      {stats.length > 0 && (
        <div style={{
          flexShrink: 0, padding: "6px 10px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 8px",
        }}>
          {stats.map(([label, value]) => (
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0, width: 52 }}>{label}</span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── CONTENT BODY ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "8px 10px" }}>

        {/* Text blocks — view mode, clean */}
        {textBlocks.length > 0 && (
          <RichTextRenderer
            blocks={textBlocks}
            onBlockUpdate={!readOnly ? handleBlockUpdate : undefined}
          />
        )}

        {/* Checklist */}
        {hasList && (
          <RichTextRenderer
            blocks={content.blocks.filter(b => b.type === "checklist")}
            checklistHandlers={!readOnly ? {
              onToggle: handleToggle, onAdd: handleAdd, onRemove: handleRemove,
              onAiGenerate: handleAiGenerate, aiLoading,
            } : undefined}
          />
        )}

        {/* History */}
        <PanelHistory nodeId={node.id} treeId={node.data.tree_id} />
      </div>

      {/* ── FOOTER — Relations toggle ──────────────────────────────────── */}
      {!readOnly && (
        <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button
            onClick={() => setShowRelations(r => !r)}
            style={{
              width: "100%", padding: "7px 12px", display: "flex", alignItems: "center",
              justifyContent: "space-between", background: "none", border: "none",
              cursor: "pointer", fontFamily: "monospace", fontSize: 10,
              color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em",
            }}
          >
            <span>⛓ Relations</span>
            <span style={{ opacity: 0.5 }}>{showRelations ? "▲" : "▼"}</span>
          </button>
          {showRelations && (
            <div style={{ padding: "0 12px 10px" }}>
              <PanelRelations nodeId={node.id} treeId={node.data.tree_id} />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
