"use client";

import { useState } from "react";
import { useTreeStore } from "@/lib/store/tree-store";
import { createClient } from "@/lib/supabase/client";
import { describeChange } from "@/lib/ai/parse";
import { applyChecklistTool } from "@/lib/ai/apply-checklist";
import type { PendingChange as PendingChangeType, ToolCall } from "@/types/chat";
import type { SkillNode, EdgeType } from "@/types/skill-tree";
import { motion } from "framer-motion";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "sonner";

interface PendingChangeProps {
  change: PendingChangeType;
  treeId: string;
}

export function PendingChange({ change, treeId }: PendingChangeProps) {
  const { addNode, removeNode, updateNode, updateNodeContent, addEdge, removeEdge, resolvePendingChange, pushHistory, nodes } =
    useTreeStore();
  const [accepting, setAccepting] = useState(false);

  const supabase = createClient();

  async function handleAccept() {
    setAccepting(true);
    pushHistory();
    const { action, params } = change;

    switch (action) {
      case "add_node": {
        const resolvedType = ((params.type ?? params.role) as SkillNode["type"]) ?? "planet";
        const node: SkillNode = {
          id: params.id as string,
          tree_id: treeId,
          label: params.label as string,
          description: (params.description as string) ?? null,
          status: (params.status as SkillNode["status"]) ?? "locked",
          type: resolvedType,
          role: resolvedType,
          parent_id: (params.parent_id as string) ?? null,
          priority: (params.priority as number) ?? 3,
          position_x: 0,
          position_y: 0,
          icon: null,
          metadata: null,
          properties: {},
          content: { blocks: [] },
        };
        addNode(node);
        const { error: addErr } = await supabase.from("skill_nodes").insert(node);
        if (addErr) { toast.error("Failed to add node"); setAccepting(false); return; }
        toast.success(`Added "${node.label}"`);
        break;
      }
      case "remove_node": {
        const nodeId = params.id as string;
        removeNode(nodeId);
        // Remove node + children from DB
        await supabase.from("skill_nodes").delete().eq("id", nodeId);
        // Children are cascade-removed by removeNode in store,
        // but we also need to clean them from DB
        await supabase
          .from("skill_nodes")
          .delete()
          .eq("tree_id", treeId)
          .eq("parent_id", nodeId);
        toast.success("Node removed");
        break;
      }
      case "update_node": {
        const nodeId = params.id as string;
        const updates: Partial<SkillNode> = {};
        if (params.label) updates.label = params.label as string;
        if (params.description) updates.description = params.description as string;
        if (params.status) updates.status = params.status as SkillNode["status"];
        if (params.type ?? params.role) {
          const t = ((params.type ?? params.role) as SkillNode["type"]);
          updates.type = t;
          updates.role = t;
        }
        if (params.parent_id !== undefined) updates.parent_id = params.parent_id as string | null;
        if (params.priority) updates.priority = params.priority as number;
        updateNode(nodeId, updates);
        const { error: updErr } = await supabase.from("skill_nodes").update(updates).eq("id", nodeId);
        if (updErr) { toast.error("Failed to update node"); setAccepting(false); return; }
        toast.success("Node updated");
        break;
      }
      case "set_checklist":
      case "add_checklist_items":
      case "update_checklist_item": {
        const nodeId = params.node_id as string;
        const toolCall: ToolCall = { id: change.id, name: action, input: params };
        const existingNode = nodes.find((n) => n.id === nodeId);
        const existingContent = existingNode?.data.content ?? { blocks: [] };
        const newContent = applyChecklistTool(toolCall, existingContent);
        if (newContent) {
          updateNodeContent(nodeId, newContent);
          await supabase
            .from("skill_nodes")
            .update({ content: newContent })
            .eq("id", nodeId)
            .eq("tree_id", treeId);
          toast.success("Checklist updated");
        }
        break;
      }
      case "add_edge": {
        await addEdge({
          id: params.id as string,
          source_id: params.source_id as string,
          target_id: params.target_id as string,
          type: (params.type as EdgeType) ?? "related",
          label: (params.label as string) ?? null,
          weight: (params.weight as number) ?? 1.0,
        });
        toast.success(`Edge added: ${params.source_id} → ${params.target_id}`);
        break;
      }
      case "remove_edge": {
        await removeEdge(params.id as string);
        toast.success("Edge removed");
        break;
      }
    }

    resolvePendingChange(change.id, true);
  }

  function handleReject() {
    resolvePendingChange(change.id, false);
  }

  const actionColors: Record<string, string> = {
    add_node: "text-emerald-400",
    remove_node: "text-red-400",
    update_node: "text-amber-400",
    set_checklist: "text-violet-400",
    add_checklist_items: "text-violet-400",
    update_checklist_item: "text-violet-400",
    add_edge: "text-cyan-400",
    remove_edge: "text-red-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-lg p-2.5 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs font-mono ${actionColors[change.action] ?? "text-slate-400"}`}
        >
          {describeChange(change)}
        </span>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {accepting && <Spinner className="w-3 h-3" />}
            {accepting ? "..." : "Accept"}
          </button>
          <button
            onClick={handleReject}
            className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </motion.div>
  );
}
