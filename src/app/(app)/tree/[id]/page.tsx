"use client";

import { useEffect, useState, use, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTreeStore, layoutGalaxy } from "@/lib/store/tree-store";
import { useChatStore } from "@/lib/store/chat-store";
import { SkillTreeCanvas } from "@/components/canvas/SkillTreeCanvas";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { SkillNode } from "@/types/skill-tree";

export default function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [treeName, setTreeName] = useState("");
  const [loading, setLoading] = useState(true);
  const { setTreeId, setNodes, pushHistory } = useTreeStore();
  const { setMessages } = useChatStore();
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setTreeId(id);
    loadTree();
  }, [id]);

  async function loadTree() {
    const [treeRes, nodesRes, messagesRes] = await Promise.all([
      supabase.from("skill_trees").select("*").eq("id", id).single(),
      supabase.from("skill_nodes").select("*").eq("tree_id", id),
      supabase
        .from("chat_messages")
        .select("*")
        .eq("tree_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (treeRes.data) {
      setTreeName(treeRes.data.name);
    }

    const nodes = (nodesRes.data ?? []) as SkillNode[];
    setNodes(layoutGalaxy(nodes));
    pushHistory();

    setMessages(
      (messagesRes.data ?? []).map((m) => ({
        id: m.id,
        tree_id: m.tree_id,
        role: m.role,
        content: m.content,
        tool_calls: m.tool_calls,
        created_at: m.created_at,
      }))
    );

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Loading galaxy...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="glass border-b border-glass-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
          >
            &larr; Back
          </a>
          <h1 className="font-mono font-semibold text-lg">{treeName}</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative min-w-0">
          <SkillTreeCanvas />
        </div>
        {/* Collapsed tab */}
        {chatCollapsed && (
          <button
            onClick={() => setChatCollapsed(false)}
            className="w-8 shrink-0 glass border-l border-glass-border flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors"
            title="Expand AI Assistant"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[10px] font-mono" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>AI</span>
          </button>
        )}
        {/* Full chat panel */}
        {!chatCollapsed && (
          <ChatPanel treeId={id} onCollapse={() => setChatCollapsed(true)} />
        )}
      </div>
    </div>
  );
}
