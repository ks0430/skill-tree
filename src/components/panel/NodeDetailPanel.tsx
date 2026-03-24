"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Node3D } from "@/lib/store/tree-store";
import type { NodeContent } from "@/types/node-content";
import {
  parseContent,
  getChecklist,
  toggleItem,
  addItem,
  removeItem,
  upsertChecklist,
} from "@/lib/content/checklist";
import { PanelHeader } from "./PanelHeader";
import { PanelStatus } from "./PanelStatus";
import { PanelChecklist } from "./PanelChecklist";

interface NodeDetailPanelProps {
  node: Node3D;
  pinned?: boolean;
  onClose?: () => void;
}

export function NodeDetailPanel({ node, pinned = false, onClose }: NodeDetailPanelProps) {
  const [content, setContent] = useState<NodeContent>(() =>
    parseContent(node.data.content ?? { blocks: [] })
  );
  const [aiLoading, setAiLoading] = useState(false);
  const supabase = createClient();

  const checklist = getChecklist(content);

  const persist = useCallback(async (next: NodeContent) => {
    setContent(next);
    await supabase
      .from("skill_nodes")
      .update({ content: next })
      .eq("id", node.id)
      .eq("tree_id", node.data.tree_id);
  }, [node.id, node.data.tree_id, supabase]);

  const handleToggle = useCallback((itemId: string) => {
    persist(toggleItem(content, itemId));
  }, [content, persist]);

  const handleAdd = useCallback((text: string) => {
    persist(addItem(content, text));
  }, [content, persist]);

  const handleRemove = useCallback((itemId: string) => {
    persist(removeItem(content, itemId));
  }, [content, persist]);

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

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.15 }}
      className="absolute top-4 left-4 glass rounded-xl p-4 w-72 z-10"
      style={{ pointerEvents: pinned ? "auto" : "none" }}
    >
      <PanelHeader
        role={node.data.role}
        label={node.data.label}
        pinned={pinned}
        onClose={onClose}
      />

      {node.data.description && (
        <p className="text-xs text-slate-400 leading-relaxed">{node.data.description}</p>
      )}

      <PanelStatus status={node.data.status} />

      <PanelChecklist
        nodeId={node.id}
        items={checklist?.items ?? []}
        onToggle={handleToggle}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onAiGenerate={handleAiGenerate}
        aiLoading={aiLoading}
      />
    </motion.div>
  );
}
