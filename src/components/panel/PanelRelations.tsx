"use client";

import { useState, useMemo } from "react";
import { useTreeStore } from "@/lib/store/tree-store";
import type { EdgeType, SkillEdge } from "@/types/skill-tree";

const EDGE_TYPE_OPTIONS: { value: EdgeType; label: string; color: string }[] = [
  { value: "related",    label: "Related",    color: "text-blue-400"   },
  { value: "references", label: "References", color: "text-emerald-400" },
  { value: "depends_on", label: "Depends on", color: "text-violet-400" },
  { value: "blocks",     label: "Blocks",     color: "text-red-400"    },
];

const EDGE_TYPE_DOT: Record<EdgeType, string> = {
  related:    "bg-blue-400",
  references: "bg-emerald-400",
  depends_on: "bg-violet-400",
  blocks:     "bg-red-400",
  parent:     "bg-slate-400",
};

interface PanelRelationsProps {
  nodeId: string;
  treeId: string;
}

export function PanelRelations({ nodeId, treeId }: PanelRelationsProps) {
  const nodes  = useTreeStore((s) => s.nodes);
  const edges  = useTreeStore((s) => s.edges);
  const addEdge    = useTreeStore((s) => s.addEdge);
  const removeEdge = useTreeStore((s) => s.removeEdge);

  const [query,       setQuery]       = useState("");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [edgeType,    setEdgeType]    = useState<EdgeType>("related");
  const [open,        setOpen]        = useState(false);
  const [saving,      setSaving]      = useState(false);

  // All edges that touch this node (excluding parent-type)
  const myEdges = useMemo(
    () => edges.filter(
      (e) => e.type !== "parent" && (e.source_id === nodeId || e.target_id === nodeId)
    ),
    [edges, nodeId]
  );

  // Node lookup map
  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.data.label])),
    [nodes]
  );

  // Search results — other nodes filtered by query, excluding those already linked
  const linkedIds = useMemo(() => {
    const ids = new Set<string>();
    myEdges.forEach((e) => {
      ids.add(e.source_id);
      ids.add(e.target_id);
    });
    ids.delete(nodeId); // always exclude self
    return ids;
  }, [myEdges, nodeId]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return nodes
      .filter((n) => n.id !== nodeId && !linkedIds.has(n.id) && n.data.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [nodes, nodeId, linkedIds, query]);

  const handleLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await addEdge({
        id: crypto.randomUUID(),
        source_id: nodeId,
        target_id: selectedId,
        type: edgeType,
        weight: 1.0,
      });
      setSelectedId(null);
      setQuery("");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (edge: SkillEdge) => {
    await removeEdge(edge.id);
  };

  // Ignore treeId lint — it's available on the edge payload already; we just need it for context key
  void treeId;

  return (
    <div className="mt-3 border-t border-slate-700/50 pt-3">
      {/* Section header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full text-[10px] font-mono text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
      >
        <span>Relations</span>
        <span className="flex items-center gap-1">
          {myEdges.length > 0 && (
            <span className="bg-slate-700 text-slate-300 rounded-full px-1.5 py-0.5 text-[9px]">
              {myEdges.length}
            </span>
          )}
          <span>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Existing edges */}
          {myEdges.length > 0 && (
            <ul className="space-y-1">
              {myEdges.map((e) => {
                const otherId = e.source_id === nodeId ? e.target_id : e.source_id;
                const otherLabel = nodeMap.get(otherId) ?? otherId.slice(0, 8) + "…";
                const direction = e.source_id === nodeId ? "→" : "←";
                return (
                  <li key={e.id} className="flex items-center gap-1.5 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${EDGE_TYPE_DOT[e.type] ?? "bg-slate-400"}`} />
                    <span className="text-slate-400 font-mono text-[10px]">{direction}</span>
                    <span className="text-slate-300 truncate flex-1">{otherLabel}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{e.type}</span>
                    <button
                      onClick={() => handleRemove(e)}
                      className="text-slate-600 hover:text-red-400 transition-colors text-[10px] leading-none ml-1"
                      title="Remove relation"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Link new node */}
          <div className="space-y-1.5">
            {/* Node search */}
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
              placeholder="Search node to link…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <ul className="bg-slate-800 border border-slate-700 rounded overflow-hidden">
                {searchResults.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => { setSelectedId(n.id); setQuery(n.data.label); }}
                      className={`w-full text-left px-2 py-1 text-xs truncate transition-colors ${
                        selectedId === n.id
                          ? "bg-slate-600 text-white"
                          : "text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {n.data.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Edge type selector */}
            <div className="flex gap-1 flex-wrap">
              {EDGE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEdgeType(opt.value)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    edgeType === opt.value
                      ? `border-current ${opt.color} bg-slate-700`
                      : "border-slate-700 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Link button */}
            <button
              onClick={handleLink}
              disabled={!selectedId || saving}
              className="w-full text-xs font-mono bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 py-1 rounded transition-colors"
            >
              {saving ? "Linking…" : "+ Link node"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
