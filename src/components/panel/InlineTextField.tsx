"use client";

import { useState, useRef, useCallback } from "react";

interface InlineTextFieldProps {
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onSave?: (newValue: string) => void;
  className?: string;
  multiline?: boolean;
}

/**
 * A lightweight click-to-edit text field used in NodeDetailPanel.
 * Shows a pencil hint on hover. Saves on blur or Enter (single-line) / Ctrl+Enter (multiline).
 */
export function InlineTextField({
  value,
  placeholder = "Click to edit…",
  readOnly = false,
  onSave,
  className = "",
  multiline = false,
}: InlineTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    if (readOnly || !onSave) return;
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [readOnly, onSave, value]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave?.(trimmed);
    }
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft(value);
        setEditing(false);
        return;
      }
      if (!multiline && e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      }
      if (multiline && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commitEdit();
      }
      e.stopPropagation();
    },
    [commitEdit, multiline, value]
  );

  const sharedInputClass =
    "w-full bg-slate-900/80 border border-violet-700/60 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-violet-500 transition-colors resize-none placeholder-slate-600";

  if (editing) {
    return multiline ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        rows={Math.max(2, draft.split("\n").length)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${sharedInputClass} mb-3`}
        autoFocus
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${sharedInputClass} mb-3`}
        autoFocus
      />
    );
  }

  // Read-only: don't show if empty
  if (readOnly && !value) return null;

  return (
    <div
      onClick={startEdit}
      title={!readOnly && onSave ? "Click to edit" : undefined}
      className={`group relative ${!readOnly && onSave ? "cursor-text" : ""} ${className}`}
    >
      {value ? (
        <span>{value}</span>
      ) : (
        <span className="text-slate-600 italic">{placeholder}</span>
      )}
      {!readOnly && onSave && (
        <span className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-violet-500 pointer-events-none select-none">
          ✎
        </span>
      )}
    </div>
  );
}
