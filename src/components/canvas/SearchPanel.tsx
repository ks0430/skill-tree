"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";

const ROLE_ICONS: Record<string, string> = {
  stellar: "star",
  planet: "planet",
  satellite: "moon",
};

const ROLE_COLORS: Record<string, string> = {
  stellar: "text-amber-400",
  planet: "text-blue-400",
  satellite: "text-slate-400",
};

export function SearchPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useTreeStore((s) => s.nodes);
  const setFocusTarget = useTreeStore((s) => s.setFocusTarget);
  const setHoveredNode = useTreeStore((s) => s.setHoveredNode);

  // Keyboard shortcut: / to open search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();
    return nodes.filter(
      (n) =>
        n.data.label.toLowerCase().includes(q) ||
        n.data.description?.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q)
    );
  }, [nodes, query]);

  // Group by hierarchy for display
  const grouped = useMemo(() => {
    const stellars = filtered.filter((n) => n.data.role === "stellar");
    const planets = filtered.filter((n) => n.data.role === "planet");
    const satellites = filtered.filter((n) => n.data.role === "satellite");
    return [...stellars, ...planets, ...satellites];
  }, [filtered]);

  function handleSelect(node: Node3D) {
    // Find the stellar ancestor to fly to
    let targetId = node.id;
    if (node.data.role === "planet" && node.data.parent_id) {
      targetId = node.data.parent_id;
    } else if (node.data.role === "satellite" && node.data.parent_id) {
      const parent = nodes.find((n) => n.id === node.data.parent_id);
      if (parent?.data.parent_id) targetId = parent.data.parent_id;
      else if (parent) targetId = parent.id;
    }
    setFocusTarget(targetId);
    setHoveredNode(node.id);
    setTimeout(() => setHoveredNode(null), 3000);
  }

  const statusDot: Record<string, string> = {
    locked: "bg-slate-600",
    in_progress: "bg-amber-500",
    completed: "bg-emerald-500",
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="absolute top-4 right-4 z-10 glass rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-2"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Search
        <kbd className="text-[9px] bg-navy-800 px-1 py-0.5 rounded text-slate-500">/</kbd>
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-10 w-72">
      <div className="glass rounded-xl overflow-hidden">
        {/* Search input */}
        <div className="p-2 border-b border-glass-border">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              onClick={() => { setOpen(false); setQuery(""); }}
              className="text-slate-500 hover:text-white text-xs"
            >
              ESC
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">
              {query ? "No matches" : "No nodes yet"}
            </div>
          ) : (
            grouped.map((node) => (
              <button
                key={node.id}
                onClick={() => handleSelect(node)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-2 group"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[node.data.status]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-mono uppercase ${ROLE_COLORS[node.data.role]}`}>
                      {ROLE_ICONS[node.data.role]}
                    </span>
                    <span className="text-xs text-white truncate">
                      {node.data.label}
                    </span>
                  </div>
                  {node.data.description && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {node.data.description}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-glass-border text-[9px] text-slate-600">
          {grouped.length} node{grouped.length !== 1 ? "s" : ""}
          {query && ` matching "${query}"`}
        </div>
      </div>
    </div>
  );
}
