"use client";

import { useTreeStore } from "@/lib/store/tree-store";
import { DEFAULT_VIEW_CONFIGS } from "@/types/skill-tree";

const VIEW_TYPE_ICONS: Record<string, string> = {
  solar_system: "🪐",
  kanban: "📋",
  gantt: "📅",
};

export function ViewSwitcher() {
  const viewMode = useTreeStore((s) => s.viewMode);
  const setViewMode = useTreeStore((s) => s.setViewMode);
  const viewConfigs = useTreeStore((s) => s.viewConfigs);

  const configs = viewConfigs.length > 0 ? viewConfigs : DEFAULT_VIEW_CONFIGS;

  return (
    <div className="flex items-center rounded border border-glass-border overflow-hidden text-xs font-mono">
      {configs.map((vc, i) => (
        <button
          key={vc.id}
          onClick={() => setViewMode(vc.id)}
          title={vc.name}
          className={`px-3 py-1.5 transition-colors ${i > 0 ? "border-l border-glass-border" : ""} ${
            viewMode === vc.id
              ? "bg-indigo-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          {VIEW_TYPE_ICONS[vc.type] ?? "📄"} {vc.name}
        </button>
      ))}
    </div>
  );
}
