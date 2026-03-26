"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Node3D } from "@/lib/store/tree-store";
import { useTreeStore } from "@/lib/store/tree-store";
import { InlineTextField } from "./InlineTextField";
import type { NodeContent } from "@/types/node-content";
import {
  parseContent,
  getChecklist,
  toggleItem,
  addItem,
  removeItem,
  upsertChecklist,
  updateBlockText,
} from "@/lib/content/checklist";
import { PanelHeader } from "./PanelHeader";
import { PanelStatus } from "./PanelStatus";
import { PanelDates } from "./PanelDates";
import { PanelRelations } from "./PanelRelations";
import { RichTextRenderer } from "./RichTextRenderer";
import { PanelHistory } from "./PanelHistory";

interface NodeDetailPanelProps {
  node: Node3D;
  pinned?: boolean;
  onClose?: () => void;
  readOnly?: boolean;
}

export function NodeDetailPanel({ node, pinned = false, onClose, readOnly = false }: NodeDetailPanelProps) {
  const [content, setContent] = useState<NodeContent>(() =>
    parseContent(node.data.content ?? { blocks: [] })
  );
  const [aiLoading, setAiLoading] = useState(false);
  const supabase = createClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateNode = useTreeStore((s) => s.updateNode);

  const props = (node.data.properties ?? {}) as Record<string, string | null>;

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

  const writeToDb = useCallback(async (next: NodeContent) => {
    await supabase
      .from("skill_nodes")
      .update({ content: next })
      .eq("id", node.id)
      .eq("tree_id", node.data.tree_id);
  }, [node.id, node.data.tree_id, supabase]);

  const persist = useCallback(async (next: NodeContent) => {
    setContent(next);
    await writeToDb(next);
  }, [writeToDb]);

  const handleToggle = useCallback((itemId: string) => {
    const next = toggleItem(content, itemId);
    setContent(next);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => writeToDb(next), 500);
  }, [content, writeToDb]);

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

  const handleBlockUpdate = useCallback(async (blockId: string, newText: string) => {
    const next = updateBlockText(content, blockId, newText);
    persist(next);
  }, [content, persist]);

  const handleLabelUpdate = useCallback(async (newLabel: string) => {
    updateNode(node.id, { label: newLabel });
    await supabase
      .from("skill_nodes")
      .update({ label: newLabel })
      .eq("id", node.id)
      .eq("tree_id", node.data.tree_id);
  }, [node.id, node.data.tree_id, supabase, updateNode]);

  const handleDescriptionUpdate = useCallback(async (newDescription: string) => {
    updateNode(node.id, { description: newDescription });
    await supabase
      .from("skill_nodes")
      .update({ description: newDescription })
      .eq("id", node.id)
      .eq("tree_id", node.data.tree_id);
  }, [node.id, node.data.tree_id, supabase, updateNode]);

  // Blocks for the non-checklist rich text section (heading, paragraph, note)
  const richBlocks = content.blocks.filter(
    (b) => b.type === "heading" || b.type === "paragraph" || b.type === "note" || b.type === "code"
  );

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.15 }}
      className="absolute top-4 left-4 glass rounded-xl w-72 z-10 flex flex-col"
      style={{ pointerEvents: pinned ? "auto" : "none", maxHeight: "calc(100vh - 2rem)" }}
    >
      {/* Fixed header: title, status, dates */}
      <div className="flex-shrink-0 p-4 pb-2">
        <PanelHeader
          role={(node.data.type ?? node.data.role) as import("@/types/skill-tree").NodeRole}
          label={node.data.label}
          pinned={pinned}
          onClose={onClose}
          onLabelUpdate={!readOnly ? handleLabelUpdate : undefined}
        />

        <PanelStatus status={node.data.status} />

        <PanelDates
          dueDate={props.due_date}
          startDate={props.start_date}
          estimate={props.estimate}
          readOnly={readOnly}
          onChange={handleDateChange}
        />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
        {(node.data.description || !readOnly) && (
          <InlineTextField
            value={node.data.description ?? ""}
            placeholder="Add a description…"
            readOnly={readOnly}
            onSave={!readOnly ? handleDescriptionUpdate : undefined}
            className="text-xs text-slate-400 leading-relaxed mt-1 mb-3"
            multiline
          />
        )}

        {richBlocks.length > 0 && (
          <div className="mb-3">
            <RichTextRenderer
              blocks={richBlocks}
              onBlockUpdate={!readOnly ? handleBlockUpdate : undefined}
            />
          </div>
        )}

        {/* Checklist rendered as a content block — interactive when editable, read-only otherwise */}
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

        {!readOnly && (
          <PanelRelations nodeId={node.id} treeId={node.data.tree_id} />
        )}

        <PanelHistory nodeId={node.id} treeId={node.data.tree_id} />
      </div>
    </motion.div>
  );
}
