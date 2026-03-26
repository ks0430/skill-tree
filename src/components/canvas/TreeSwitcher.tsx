"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Tree {
  id: string;
  name: string;
}

interface TreeSwitcherProps {
  treeId: string;
  treeName: string;
}

export function TreeSwitcher({ treeId, treeName }: TreeSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trees, setTrees] = useState<Tree[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    setLoading(true);
    supabase
      .from("skill_trees")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        setTrees(data ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (open) {
      setFilter("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function switchTree(id: string) {
    setOpen(false);
    if (id !== treeId) router.replace(`/tree/${id}`);
  }

  const filtered = trees.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 font-mono font-semibold text-lg truncate max-w-[140px] sm:max-w-xs hover:text-white transition-colors"
        title="Switch tree"
      >
        <span className="truncate">{treeName}</span>
        {loading ? (
          <svg className="w-3.5 h-3.5 shrink-0 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <svg
            className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 glass border border-glass-border rounded shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-glass-border">
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter trees…"
              className="w-full bg-transparent text-sm font-mono text-white placeholder-slate-500 outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500 font-mono">No trees found</li>
            ) : (
              filtered.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => switchTree(t.id)}
                    className={`w-full text-left px-3 py-2 text-sm font-mono truncate hover:bg-white/5 transition-colors ${
                      t.id === treeId ? "text-accent-blue" : "text-slate-300"
                    }`}
                  >
                    {t.id === treeId && <span className="mr-1.5">✓</span>}
                    {t.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
