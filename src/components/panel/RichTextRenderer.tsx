"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  checklistHandlers?: ChecklistHandlers;
  onBlockUpdate?: (blockId: string, newText: string) => void;
}

// ── Auto-growing textarea ─────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  onBlur,
  onKeyDown,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);

  useEffect(() => {
    ref.current?.focus();
    // Place cursor at end
    const len = ref.current?.value.length ?? 0;
    ref.current?.setSelectionRange(len, len);
  }, []);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={1}
      className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none ${className ?? ""}`}
    />
  );
}

// ── Inline editable text block ────────────────────────────────────────────────

function EditableText({
  blockId,
  initialText,
  onSave,
  displayClass,
  editClass,
  placeholder,
  singleLine,
}: {
  blockId: string;
  initialText: string;
  onSave: (blockId: string, text: string) => void;
  displayClass: string;
  editClass: string;
  placeholder?: string;
  singleLine?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialText);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== initialText) onSave(blockId, trimmed || initialText);
  }, [blockId, draft, initialText, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { setDraft(initialText); setEditing(false); }
    if (singleLine && e.key === "Enter") { e.preventDefault(); commit(); }
    e.stopPropagation();
  }, [commit, initialText, singleLine]);

  if (editing) {
    return (
      <AutoTextarea
        value={draft}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={editClass}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => { setDraft(initialText); setEditing(true); }}
      className={`cursor-text ${displayClass} whitespace-pre-wrap break-words`}
      title="Click to edit"
    >
      {initialText || <span className="opacity-30">{placeholder ?? "Click to edit..."}</span>}
    </div>
  );
}

// ── Checklist ─────────────────────────────────────────────────────────────────

function ChecklistRow({ item, onToggle, onRemove }: {
  item: ChecklistItem;
  onToggle?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <li className="flex items-start gap-2 group py-0.5">
      {onToggle ? (
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${
            item.checked ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-slate-400"
          }`}
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
      <span className={`text-xs leading-relaxed flex-1 ${item.checked ? "line-through text-slate-600" : "text-slate-300"}`}>
        {item.text}
        {item.ai_generated && !item.checked && <span className="ml-1 text-[9px] text-violet-500 font-mono">AI</span>}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xs flex-shrink-0"
        >×</button>
      )}
    </li>
  );
}

function InteractiveChecklist({ block, handlers }: {
  block: Extract<ContentBlock, { type: "checklist" }>;
  handlers: ChecklistHandlers;
}) {
  const [draft, setDraft] = useState("");
  const { onToggle, onAdd, onRemove, onAiGenerate, aiLoading } = handlers;
  const done = block.items.filter((i) => i.checked).length;

  return (
    <div className="mt-2 pt-2 border-t border-slate-800/60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {block.title ?? "Checklist"}{block.items.length > 0 && <span className="text-slate-600 ml-1">({done}/{block.items.length})</span>}
        </span>
        <button
          type="button"
          onClick={onAiGenerate}
          disabled={aiLoading}
          className="text-[10px] px-2 py-0.5 rounded bg-violet-900/60 hover:bg-violet-800/80 text-violet-300 hover:text-white transition-colors disabled:opacity-40 font-mono"
        >
          {aiLoading ? "Thinking…" : "✦ Ask AI"}
        </button>
      </div>
      {block.items.length > 0 && (
        <ul className="space-y-0 mb-2">
          {block.items.map((item) => <ChecklistRow key={item.id} item={item} onToggle={onToggle} onRemove={onRemove} />)}
        </ul>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft.trim()) { onAdd(draft.trim()); setDraft(""); }
          e.stopPropagation();
        }}
        placeholder="Add item…"
        className="w-full bg-transparent border-b border-slate-800 focus:border-slate-600 px-0 py-0.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none transition-colors"
      />
    </div>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────

export function RichTextRenderer({ blocks, checklistHandlers, onBlockUpdate }: RichTextRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {blocks.map((block) => {
        switch (block.type) {

          case "heading": {
            const level = block.level ?? 2;
            const cls = level === 1
              ? "text-sm font-semibold text-slate-100 mt-3 mb-1"
              : level === 2
              ? "text-xs font-semibold text-slate-200 mt-2 mb-0.5 uppercase tracking-wide"
              : "text-xs font-medium text-slate-300 mt-1.5";
            if (onBlockUpdate) {
              return <EditableText key={block.id} blockId={block.id} initialText={block.text}
                onSave={onBlockUpdate} singleLine displayClass={cls}
                editClass={`${cls} border-b border-violet-700/60 focus:outline-none`} />;
            }
            const Tag = `h${level}` as "h1" | "h2" | "h3";
            return <Tag key={block.id} className={cls}>{block.text}</Tag>;
          }

          case "paragraph":
            if (onBlockUpdate) {
              return <EditableText key={block.id} blockId={block.id} initialText={block.text}
                onSave={onBlockUpdate} placeholder="Add text..."
                displayClass="text-xs text-slate-300 leading-relaxed py-0.5"
                editClass="text-xs text-slate-300 leading-relaxed py-0.5 border-b border-violet-700/40" />;
            }
            return <p key={block.id} className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words py-0.5">{block.text}</p>;

          case "note":
            if (onBlockUpdate) {
              return <EditableText key={block.id} blockId={block.id} initialText={block.text}
                onSave={onBlockUpdate}
                displayClass="text-xs text-slate-400 italic leading-relaxed border-l-2 border-slate-700 pl-2 py-0.5"
                editClass="text-xs text-slate-400 italic leading-relaxed border-l-2 border-violet-700/60 pl-2 py-0.5" />;
            }
            return <p key={block.id} className="text-xs text-slate-400 italic leading-relaxed border-l-2 border-slate-700 pl-2 py-0.5 whitespace-pre-wrap break-words">{block.text}</p>;

          case "code":
            if (onBlockUpdate) {
              return (
                <div key={block.id} className="rounded bg-slate-950 border border-slate-800 overflow-hidden my-1">
                  {block.language && <div className="px-3 py-0.5 border-b border-slate-800 text-[9px] font-mono text-slate-500 uppercase">{block.language}</div>}
                  <EditableText blockId={block.id} initialText={block.text} onSave={onBlockUpdate}
                    displayClass="px-3 py-2 text-xs text-slate-300 font-mono"
                    editClass="px-3 py-2 text-xs text-slate-300 font-mono bg-transparent" />
                </div>
              );
            }
            return (
              <div key={block.id} className="rounded bg-slate-950 border border-slate-800 overflow-hidden my-1">
                {block.language && <div className="px-3 py-0.5 border-b border-slate-800 text-[9px] font-mono text-slate-500 uppercase">{block.language}</div>}
                <pre className="px-3 py-2 text-xs text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed"><code>{block.text}</code></pre>
              </div>
            );

          case "checklist":
            return checklistHandlers
              ? <InteractiveChecklist key={block.id} block={block} handlers={checklistHandlers} />
              : (
                <div key={block.id} className="space-y-0">
                  {block.title && <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-2 mb-1">{block.title}</p>}
                  <ul className="space-y-0">
                    {block.items.map((item) => <ChecklistRow key={item.id} item={item} />)}
                  </ul>
                </div>
              );

          case "divider":
            return <hr key={block.id} className="border-0 border-t border-slate-800 my-2" />;

          default:
            return null;
        }
      })}
    </div>
  );
}
