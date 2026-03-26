"use client";

import { useState, useRef } from "react";
import type { ContentBlock, ChecklistItem } from "@/types/node-content";

interface ChecklistHandlers {
  onToggle: (itemId: string) => void;
  onAdd: (text: string) => void;
  onRemove: (itemId: string) => void;
  onAiGenerate: () => void;
  aiLoading: boolean;
}

interface RichTextRendererProps {
  blocks: ContentBlock[];
  /** If provided, checklist blocks render as interactive (editable) */
  checklistHandlers?: ChecklistHandlers;
}

function ChecklistRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ChecklistItem;
  onToggle?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-2 group">
      {onToggle ? (
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${
            item.checked
              ? "bg-emerald-500 border-emerald-500"
              : "border-slate-600 hover:border-slate-400"
          }`}
          aria-label={item.checked ? "Uncheck item" : "Check item"}
        >
          {item.checked && (
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : (
        <span className={`text-xs mt-0.5 flex-shrink-0 ${item.checked ? "text-emerald-400" : "text-slate-500"}`}>
          {item.checked ? "✓" : "○"}
        </span>
      )}
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
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xs leading-none flex-shrink-0 mt-0.5"
        >
          ×
        </button>
      )}
    </li>
  );
}

function InteractiveChecklist({
  block,
  handlers,
}: {
  block: Extract<ContentBlock, { type: "checklist" }>;
  handlers: ChecklistHandlers;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { onToggle, onAdd, onRemove, onAiGenerate, aiLoading } = handlers;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && draft.trim()) {
      onAdd(draft.trim());
      setDraft("");
    }
    e.stopPropagation();
  }

  const done = block.items.filter((i) => i.checked).length;

  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {block.title ?? "Checklist"}{" "}
          {block.items.length > 0 && (
            <span className="text-slate-600">({done}/{block.items.length})</span>
          )}
        </span>
        <button
          type="button"
          onClick={onAiGenerate}
          disabled={aiLoading}
          className="text-[10px] px-2 py-0.5 rounded bg-violet-900/60 hover:bg-violet-800/80 text-violet-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
          title="Let AI generate checklist items"
        >
          {aiLoading ? "Thinking…" : "✦ Ask AI"}
        </button>
      </div>

      {block.items.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {block.items.map((item) => (
            <ChecklistRow key={item.id} item={item} onToggle={onToggle} onRemove={onRemove} />
          ))}
        </ul>
      )}

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

function ReadOnlyChecklist({
  block,
}: {
  block: Extract<ContentBlock, { type: "checklist" }>;
}) {
  const items = block.items ?? [];
  if (items.length === 0) return null;
  const done = items.filter((i) => i.checked).length;

  return (
    <div className="space-y-1 pt-1">
      {block.title && (
        <p className="text-xs font-medium text-slate-400 mb-1">
          {block.title}
          <span className="ml-1 text-slate-500">({done}/{items.length})</span>
        </p>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function RichTextRenderer({ blocks, checklistHandlers }: RichTextRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {blocks.map((block) => {
        switch (block.type) {
          case "heading": {
            const level = block.level ?? 2;
            const sizeClass =
              level === 1
                ? "text-sm font-semibold"
                : level === 2
                ? "text-xs font-semibold"
                : "text-xs font-medium";
            const Tag = `h${level}` as "h1" | "h2" | "h3";
            return (
              <Tag
                key={block.id}
                className={`${sizeClass} text-slate-200 mt-2 first:mt-0`}
              >
                {block.text}
              </Tag>
            );
          }

          case "paragraph":
            return (
              <p key={block.id} className="text-xs text-slate-300 leading-relaxed">
                {block.text}
              </p>
            );

          case "checklist":
            return checklistHandlers ? (
              <InteractiveChecklist key={block.id} block={block} handlers={checklistHandlers} />
            ) : (
              <ReadOnlyChecklist key={block.id} block={block} />
            );

          case "note":
            return (
              <p
                key={block.id}
                className="text-xs text-slate-400 italic leading-relaxed border-l-2 border-slate-700 pl-2"
              >
                {block.text}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
