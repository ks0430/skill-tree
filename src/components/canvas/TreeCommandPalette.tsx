"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Tree {
  id: string;
  name: string;
}

interface TreeCommandPaletteProps {
  treeId: string;
}

export function TreeCommandPalette({ treeId }: TreeCommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Global Cmd/Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch trees once
  useEffect(() => {
    supabase
      .from("skill_trees")
      .select("id, name")
      .order("name")
      .then(({ data }) => setTrees(data ?? []));
  }, []);

  // Reset state on open
  useEffect(() => {
    if (open) {
      setFilter("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = trees.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Keep selected in bounds when filter changes
  useEffect(() => {
    setSelected(0);
  }, [filter]);

  function switchTree(id: string) {
    setOpen(false);
    if (id !== treeId) router.replace(`/tree/${id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      if (filtered[selected]) switchTree(filtered[selected].id);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div className="w-full max-w-md glass border border-glass-border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-glass-border">
          <svg className="w-4 h-4 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
          </svg>
          <input
            ref={inputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Switch tree…"
            className="flex-1 bg-transparent text-sm font-mono text-white placeholder-slate-500 outline-none"
          />
          <kbd className="text-[10px] font-mono text-slate-500 border border-slate-700 rounded px-1 py-0.5">ESC</kbd>
        </div>

        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 font-mono">No trees found</li>
          ) : (
            filtered.map((t, i) => (
              <li key={t.id}>
                <button
                  onClick={() => switchTree(t.id)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-mono flex items-center gap-2 transition-colors ${
                    i === selected ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {t.id === treeId ? (
                    <svg className="w-3.5 h-3.5 shrink-0 text-accent-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{t.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="px-4 py-2 border-t border-glass-border flex items-center gap-3 text-[10px] text-slate-500 font-mono">
          <span><kbd className="border border-slate-700 rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border border-slate-700 rounded px-1">↵</kbd> select</span>
          <span><kbd className="border border-slate-700 rounded px-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
