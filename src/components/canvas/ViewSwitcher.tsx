"use client";

import { useTreeStore, type ViewMode } from "@/lib/store/tree-store";

interface ViewOption {
  mode: ViewMode;
  label: string;
  title: string;
}

const VIEW_OPTIONS: ViewOption[] = [
  { mode: "solar",    label: "🪐 Solar",  title: "Solar System view (3D)" },
  { mode: "tree",     label: "🌿 Tree",   title: "Skill Tree view (2D)" },
  { mode: "gantt",    label: "📅 Gantt",  title: "Gantt chart view" },
  { mode: "weight",   label: "🕸️ Graph",  title: "Weight Graph view (force-directed)" },
  { mode: "memory",   label: "🧠 Memory", title: "Memory Map view (associative, edge-type-weighted)" },
  { mode: "kanban",   label: "📋 Board",  title: "Kanban board view (Backlog / Active / Done)" },
  { mode: "worldmap", label: "🗺️ Map",    title: "World Map view (RPG-style dependency map)" },
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
