"use client";

import { useTreeStore, type ViewMode } from "@/lib/store/tree-store";

interface ViewOption {
  mode: ViewMode;
  label: string;
  title: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { mode: "solar",  label: "🪐 Solar",      title: "Solar System view (3D)" },
  { mode: "tree",   label: "🌿 Skill Tree", title: "Skill Tree view — dependency graph (2D)" },
  { mode: "radial", label: "🔮 Radial",     title: "Radial skill tree — Path of Exile style, force-directed" },
  { mode: "force",  label: "⚡ Force",      title: "Force graph — Canvas renderer, 60fps, unique node shapes" },
  { mode: "weight", label: "🕸️ Graph",      title: "Graph view — force-directed, clusters by connections" },
  { mode: "kanban", label: "📋 Board",      title: "Kanban board — Backlog / Active / Done" },
  { mode: "gantt",  label: "📅 Timeline",   title: "Gantt / Timeline view" },
];

export function ViewSwitcher() {
  const viewMode = useTreeStore((s) => s.viewMode);
  const setViewMode = useTreeStore((s) => s.setViewMode);

  return (
    <div className="flex items-center rounded border border-glass-border overflow-hidden text-xs font-mono">
      {VIEW_OPTIONS.map((opt, i) => (
        <button
          key={opt.mode}
          onClick={() => setViewMode(opt.mode)}
          title={opt.title}
          className={`px-3 py-1.5 transition-colors ${i > 0 ? "border-l border-glass-border" : ""} ${
            viewMode === opt.mode
              ? "bg-indigo-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
