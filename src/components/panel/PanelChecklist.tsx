"use client";

import { useState, useRef } from "react";
import type { ChecklistItem } from "@/types/node-content";

interface PanelChecklistProps {
  nodeId: string;
  items: ChecklistItem[];
  onToggle: (itemId: string) => void;
  onAdd: (text: string) => void;
  onRemove: (itemId: string) => void;
  onAiGenerate: () => void;
  aiLoading: boolean;
}

export function PanelChecklist({
  nodeId,
  items,
  onToggle,
  onAdd,
  onRemove,
  onAiGenerate,
  aiLoading,
}: PanelChecklistProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && draft.trim()) {
      onAdd(draft.trim());
      setDraft("");
    }
    e.stopPropagation(); // prevent space from triggering node status toggle
  }

  const done = items.filter((i) => i.checked).length;

  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Checklist {items.length > 0 && <span className="text-slate-600">({done}/{items.length})</span>}
        </span>
        <button
          onClick={onAiGenerate}
          disabled={aiLoading}
          className="text-[10px] px-2 py-0.5 rounded bg-violet-900/60 hover:bg-violet-800/80 text-violet-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
          title="Let AI generate checklist items"
        >
          {aiLoading ? "Thinking…" : "✦ Ask AI"}
        </button>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 group">
              <button
                onClick={() => onToggle(item.id)}
                className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${
                  item.checked
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-slate-600 hover:border-slate-400"
                }`}
              >
                {item.checked && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span
                className={`text-xs leading-tight flex-1 ${
                  item.checked ? "line-through text-slate-600" : "text-slate-300"
                }`}
              >
                {item.text}
                {item.ai_generated && !item.checked && (
                  <span className="ml-1 text-[9px] text-violet-500 font-mono">AI</span>
                )}
              </span>
              <button
                onClick={() => onRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xs leading-none flex-shrink-0 mt-0.5"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add item input */}
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add item…"
        className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
      />
    </div>
  );
}
