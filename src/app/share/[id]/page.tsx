"use client";

import { useEffect, useState, use } from "react";
import { useTreeStore, layoutGalaxy } from "@/lib/store/tree-store";
import { ReadOnlyCanvas } from "@/components/canvas/ReadOnlyCanvas";
import { CanvasErrorBoundary } from "@/components/ui/CanvasErrorBoundary";
import type { SkillNode } from "@/types/skill-tree";

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [treeName, setTreeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { setTreeId, setNodes } = useTreeStore();

  useEffect(() => {
    setTreeId(id);
    loadSharedTree();
  }, [id]);

  async function loadSharedTree() {
    const res = await fetch(`/api/share/${id}`);
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const { tree, nodes } = await res.json();
    setTreeName(tree.name);

    const mapped = (nodes as SkillNode[]).map((n) => ({
      ...n,
      content: n.content ?? { blocks: [] },
    }));
    setNodes(layoutGalaxy(mapped));
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0e1a]">
        <div className="text-slate-500 font-mono">Loading galaxy...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0e1a] gap-4">
        <div className="text-6xl">🌌</div>
        <div className="text-slate-400 font-mono">Galaxy not found</div>
        <a href="/" className="text-sm text-accent-blue hover:underline">
          Back to SkillForge
        </a>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0e1a]">
      <header className="glass border-b border-glass-border px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 text-sm font-mono">SkillForge</span>
          <span className="text-slate-600">/</span>
          <h1 className="font-mono font-semibold text-lg">{treeName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono px-2 py-1 rounded border border-glass-border">
            Read-only
          </span>
          <a
            href="/"
            className="text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded border border-glass-border hover:border-accent-blue/40 transition-colors font-mono"
          >
            Open SkillForge
          </a>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <CanvasErrorBoundary>
          <ReadOnlyCanvas />
        </CanvasErrorBoundary>
      </div>
    </div>
  );
}
