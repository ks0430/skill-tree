"use client";

import { useEffect, useState, use, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTreeStore, layoutGalaxy } from "@/lib/store/tree-store";
import { useChatStore } from "@/lib/store/chat-store";
import { SkillTreeCanvas } from "@/components/canvas/SkillTreeCanvas";
import { CanvasErrorBoundary } from "@/components/ui/CanvasErrorBoundary";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { SkillNode } from "@/types/skill-tree";
import { toast } from "sonner";

export default function TreePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [treeName, setTreeName] = useState("");
  const [loading, setLoading] = useState(true);
  const { setTreeId, setNodes, pushHistory, nodes } = useTreeStore();
  const { setMessages } = useChatStore();
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const supabase = createClient();

  // Detect mobile and auto-collapse chat panel on narrow screens
  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setChatCollapsed(true);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

    const nodes = (nodesRes.data ?? []).map((n) => ({
      ...n,
      content: n.content ?? { blocks: [] },
    })) as SkillNode[];
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

  function shareTree() {
    const shareUrl = `${window.location.origin}/share/${id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success("Share link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  }

  function exportTree() {
    const payload = {
      id,
      name: treeName,
      exported_at: new Date().toISOString(),
      nodes: nodes.map((n) => n.data),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${treeName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "tree"}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
          <h1 className="font-mono font-semibold text-lg truncate max-w-[140px] sm:max-w-none">{treeName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={shareTree}
            className="text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded border border-glass-border hover:border-accent-blue/40 transition-colors font-mono"
            title="Copy read-only share link"
          >
            🔗 Share
          </button>
          <button
            onClick={exportTree}
            className="hidden sm:inline-flex text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded border border-glass-border hover:border-accent-blue/40 transition-colors font-mono"
            title="Export tree as JSON"
          >
            Export JSON
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas — always full area on mobile, shared on desktop */}
        <div className="flex-1 relative min-w-0">
          <CanvasErrorBoundary>
            <SkillTreeCanvas />
          </CanvasErrorBoundary>
        </div>

        {/* Desktop: collapsed tab — always in DOM, shown/hidden via display */}
        {!isMobile && (
          <button
            onClick={() => setChatCollapsed(false)}
            title="Expand AI Assistant"
            style={{ display: chatCollapsed ? "flex" : "none" }}
            className="w-8 shrink-0 glass border-l border-glass-border flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-[10px] font-mono" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>AI</span>
          </button>
        )}

        {/* Desktop: full chat panel — always in DOM, shown/hidden via display */}
        {!isMobile && (
          <div style={{ display: chatCollapsed ? "none" : "flex" }} className="w-96 shrink-0">
            <ChatPanel treeId={id} onCollapse={() => setChatCollapsed(true)} />
          </div>
        )}

        {/* Mobile: floating AI toggle button */}
        {isMobile && chatCollapsed && (
          <button
            onClick={() => setChatCollapsed(false)}
            title="Open AI Assistant"
            className="absolute bottom-4 right-4 z-20 glass border border-glass-border rounded-full w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white shadow-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        )}

        {/* Mobile: chat panel as full-screen overlay */}
        {isMobile && !chatCollapsed && (
          <div className="absolute inset-0 z-30 flex flex-col">
            <ChatPanel treeId={id} onCollapse={() => setChatCollapsed(true)} />
          </div>
        )}
      </div>
    </div>
  );
}
