"use client";

import { useState, useRef, useCallback } from "react";

const typeLabels: Record<string, string> = {
  stellar: "Star System",
  planet: "Planet",
  satellite: "Moon",
};

interface PanelHeaderProps {
  type: string;
  label: string;
  pinned: boolean;
  onClose?: () => void;
  /** If provided, the label becomes click-to-edit */
  onLabelUpdate?: (newLabel: string) => void;
}

export function PanelHeader({ type, label, pinned, onClose, onLabelUpdate }: PanelHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    if (!onLabelUpdate) return;
    setDraft(label);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [label, onLabelUpdate]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) {
      onLabelUpdate?.(trimmed);
    }
  }, [draft, label, onLabelUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        setDraft(label);
        setEditing(false);
      }
      e.stopPropagation();
    },
    [commitEdit, label]
  );

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {typeLabels[type] ?? type}
        </span>
        {pinned && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Pinned
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors text-xs leading-none"
                title="Unpin (ESC)"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-900/80 border border-violet-700/60 rounded px-2 py-0.5 font-mono font-bold text-white text-sm mt-0.5 focus:outline-none focus:border-violet-500 transition-colors"
          autoFocus
        />
      ) : (
        <div
          onClick={startEdit}
          title={onLabelUpdate ? "Click to edit" : undefined}
          className={`group relative mt-0.5 ${onLabelUpdate ? "cursor-text" : ""}`}
        >
          <h3 className="font-mono font-bold text-white text-sm">{label}</h3>
          {onLabelUpdate && (
            <span className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-violet-500 pointer-events-none select-none">
              ✎
            </span>
          )}
        </div>
      )}
    </div>
  );
}
