"use client";

/**
 * NotionBlockEditor
 *
 * A lightweight Notion-style block editor for node descriptions.
 * - Each block is click-to-edit inline
 * - Type "/" at the start of an empty paragraph to open a block-type picker
 * - Supports: paragraph, heading (h1/h2/h3), note, code, divider, checklist
 * - Renders with proper typography matching the existing RichTextRenderer styles
 * - Persists changes via onUpdate callback
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { ContentBlock, ChecklistItem } from "@/types/node-content";

// ── uid ───────────────────────────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotionBlockEditorProps {
  blocks: ContentBlock[];
  readOnly?: boolean;
  onUpdate: (blocks: ContentBlock[]) => void;
}

// Slash-menu options
const SLASH_MENU_ITEMS = [
  { type: "paragraph", icon: "¶", label: "Paragraph", shortcut: "p" },
  { type: "heading1", icon: "H1", label: "Heading 1", shortcut: "h1" },
  { type: "heading2", icon: "H2", label: "Heading 2", shortcut: "h2" },
  { type: "heading3", icon: "H3", label: "Heading 3", shortcut: "h3" },
  { type: "note", icon: "✎", label: "Note", shortcut: "n" },
  { type: "code", icon: "</>", label: "Code", shortcut: "c" },
  { type: "divider", icon: "—", label: "Divider", shortcut: "d" },
  { type: "checklist", icon: "☑", label: "Checklist", shortcut: "l" },
] as const;

type SlashMenuType = typeof SLASH_MENU_ITEMS[number]["type"];

// ── Checklist row ─────────────────────────────────────────────────────────────

function ChecklistRow({
  item,
  readOnly,
  onToggle,
  onTextChange,
  onRemove,
  onKeyDown,
  inputRef,
}: {
  item: ChecklistItem;
  readOnly?: boolean;
  onToggle: () => void;
  onTextChange: (text: string) => void;
  onRemove: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <li className="flex items-center gap-2 group">
      <button
        type="button"
        onClick={readOnly ? undefined : onToggle}
        className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center transition-colors ${
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
      {readOnly ? (
        <span className={`text-xs flex-1 ${item.checked ? "line-through text-slate-600" : "text-slate-300"}`}>
          {item.text}
        </span>
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={item.text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          className={`text-xs flex-1 bg-transparent outline-none ${item.checked ? "line-through text-slate-600" : "text-slate-300"}`}
        />
      )}
      {!readOnly && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all text-xs"
        >
          ×
        </button>
      )}
    </li>
  );
}

// ── Single Block ──────────────────────────────────────────────────────────────

function BlockRow({
  block,
  readOnly,
  isFocused,
  onFocus,
  onUpdate,
  onDelete,
  onInsertAfter,
  onSlashTrigger,
  focusRef,
}: {
  block: ContentBlock;
  readOnly?: boolean;
  isFocused: boolean;
  onFocus: () => void;
  onUpdate: (updated: ContentBlock) => void;
  onDelete: () => void;
  onInsertAfter: (type?: ContentBlock["type"]) => void;
  onSlashTrigger: (query: string) => void;
  focusRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
}) {
  const [editing, setEditing] = useState(false);

  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      e.stopPropagation();

      const target = e.currentTarget;
      const val = target.value;

      // Slash at start of empty block → open picker
      if (e.key === "/" && val === "") {
        e.preventDefault();
        onSlashTrigger("");
        return;
      }

      if (e.key === "Escape") {
        setEditing(false);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // For single-line blocks, Enter inserts a new paragraph after
        if (block.type === "heading" || block.type === "note") {
          e.preventDefault();
          setEditing(false);
          onInsertAfter("paragraph");
          return;
        }
      }
      if (e.key === "Backspace" && val === "") {
        e.preventDefault();
        onDelete();
      }
    },
    [block.type, onDelete, onInsertAfter, onSlashTrigger]
  );

  // ── Display rendering ──────────────────────────────────────────────────────
  const renderDisplay = () => {
    switch (block.type) {
      case "heading": {
        const level = block.level ?? 2;
        const cls =
          level === 1
            ? "text-sm font-semibold text-slate-100 mt-2 first:mt-0 cursor-text"
            : level === 2
            ? "text-xs font-semibold text-slate-200 mt-1.5 first:mt-0 cursor-text"
            : "text-xs font-medium text-slate-300 mt-1 first:mt-0 cursor-text";
        const Tag = `h${level}` as "h1" | "h2" | "h3";
        return (
          <Tag className={cls} onClick={readOnly ? undefined : () => setEditing(true)}>
            {block.text || <span className="text-slate-600 italic">Heading…</span>}
          </Tag>
        );
      }
      case "paragraph":
        return (
          <p
            className="text-xs text-slate-300 leading-relaxed cursor-text"
            onClick={readOnly ? undefined : () => setEditing(true)}
          >
            {block.text || <span className="text-slate-600 italic">Start typing… (type / for blocks)</span>}
          </p>
        );
      case "note":
        return (
          <p
            className="text-xs text-slate-400 italic leading-relaxed border-l-2 border-slate-700 pl-2 cursor-text"
            onClick={readOnly ? undefined : () => setEditing(true)}
          >
            {block.text || <span className="text-slate-600">Note…</span>}
          </p>
        );
      case "code":
        return (
          <div
            className="rounded bg-slate-950 border border-slate-800 overflow-x-auto cursor-text"
            onClick={readOnly ? undefined : () => setEditing(true)}
          >
            {block.language && (
              <div className="px-3 py-1 border-b border-slate-800 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                {block.language}
              </div>
            )}
            <pre className="px-3 py-2 text-xs text-slate-300 font-mono whitespace-pre-wrap break-all leading-relaxed">
              <code>{block.text || <span className="text-slate-600">Code…</span>}</code>
            </pre>
          </div>
        );
      case "divider":
        return <hr className="border-0 border-t border-slate-800 my-2" />;
      case "checklist":
        return null; // handled separately
      default:
        return null;
    }
  };

  // ── Edit rendering ─────────────────────────────────────────────────────────
  const renderEdit = () => {
    if (block.type === "divider" || block.type === "checklist") return null;

    const sharedClass =
      "w-full bg-slate-900/80 border border-violet-700/60 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500 transition-colors resize-none";

    const isMultiline = block.type === "paragraph" || block.type === "code";

    const value = (block as { text?: string }).text ?? "";

    const handleChange = (val: string) => {

      // Check for slash command
      if (val === "/") {
        onSlashTrigger("");
        return;
      }
      if (val.startsWith("/") && val.length > 1) {
        onSlashTrigger(val.slice(1));
        return;
      }

      onUpdate({ ...block, text: val } as ContentBlock);
    };

    const handleBlur = () => setEditing(false);

    if (isMultiline) {
      return (
        <textarea
          ref={focusRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          rows={Math.max(2, value.split("\n").length)}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleTextKeyDown as unknown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          className={`${sharedClass} ${block.type === "code" ? "font-mono" : ""}`}
          autoFocus
        />
      );
    }

    return (
      <input
        ref={focusRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleTextKeyDown as unknown as React.KeyboardEventHandler<HTMLInputElement>}
        className={sharedClass}
        autoFocus
      />
    );
  };

  if (block.type === "checklist") {
    // Checklist handled by parent — skip here
    return null;
  }

  if (block.type === "divider") {
    return (
      <div className="group relative" onClick={onFocus}>
        {renderDisplay()}
        {!readOnly && isFocused && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="absolute -right-1 -top-1 text-[9px] text-red-500 hover:text-red-400 bg-slate-900 rounded px-1"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="group relative" onMouseDown={onFocus}>
      {editing ? renderEdit() : (
        <div className="relative">
          {renderDisplay()}
          {!readOnly && (
            <span className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-violet-500 pointer-events-none select-none">
              ✎
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Slash Menu ────────────────────────────────────────────────────────────────

function SlashMenu({
  query,
  onSelect,
  onClose,
}: {
  query: string;
  onSelect: (type: SlashMenuType) => void;
  onClose: () => void;
}) {
  const filtered = SLASH_MENU_ITEMS.filter(
    (item) =>
      query === "" ||
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.shortcut.includes(query.toLowerCase())
  );

  const [hovered, setHovered] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        setHovered((h) => Math.min(h + 1, filtered.length - 1));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setHovered((h) => Math.max(h - 1, 0));
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (filtered[hovered]) onSelect(filtered[hovered].type);
        e.preventDefault();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, hovered, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute z-50 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
      <div className="px-2 py-1 text-[10px] text-slate-500 font-mono border-b border-slate-800">
        / block type
      </div>
      {filtered.map((item, i) => (
        <button
          key={item.type}
          type="button"
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
            i === hovered ? "bg-violet-900/60 text-white" : "text-slate-300 hover:bg-slate-800"
          }`}
          onMouseEnter={() => setHovered(i)}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item.type); }}
        >
          <span className="font-mono text-[10px] text-slate-500 w-6 text-center">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────────────────────

export function NotionBlockEditor({ blocks, readOnly = false, onUpdate }: NotionBlockEditorProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [slashState, setSlashState] = useState<{ blockId: string; query: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter out checklist blocks — those are rendered elsewhere
  const descBlocks = blocks.filter((b) => b.type !== "checklist");

  // Create a default paragraph if empty and not readOnly
  const displayBlocks: ContentBlock[] = descBlocks.length === 0 && !readOnly
    ? [{ id: uid(), type: "paragraph", text: "" }]
    : descBlocks;

  const updateBlock = useCallback(
    (updated: ContentBlock) => {
      const next = blocks.map((b) => (b.id === updated.id ? updated : b));
      // If the block wasn't in blocks (e.g. the default empty one), add it
      if (!blocks.find((b) => b.id === updated.id)) {
        onUpdate([...blocks.filter((b) => b.type !== "checklist"), updated, ...blocks.filter((b) => b.type === "checklist")]);
        return;
      }
      onUpdate(next);
    },
    [blocks, onUpdate]
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      const remaining = blocks.filter((b) => b.id !== blockId);
      onUpdate(remaining);
    },
    [blocks, onUpdate]
  );

  const insertAfter = useCallback(
    (afterId: string, type: ContentBlock["type"] = "paragraph") => {
      const newBlock = createBlock(type);
      const idx = blocks.findIndex((b) => b.id === afterId);
      const next = [...blocks];
      next.splice(idx + 1, 0, newBlock);
      onUpdate(next);
      setFocusedId(newBlock.id);
    },
    [blocks, onUpdate]
  );

  const handleSlashTrigger = useCallback((blockId: string, query: string) => {
    setSlashState({ blockId, query });
  }, []);

  const handleSlashSelect = useCallback(
    (type: SlashMenuType) => {
      if (!slashState) return;
      const { blockId } = slashState;
      setSlashState(null);

      const newBlock = createBlockFromSlash(type);

      // Replace the current block or insert after
      const idx = blocks.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        const existing = blocks[idx];
        // If current block is empty paragraph, replace it
        if (existing.type === "paragraph" && (existing as { text: string }).text === "") {
          const next = [...blocks];
          next.splice(idx, 1, newBlock);
          onUpdate(next);
          setFocusedId(newBlock.id);
        } else {
          const next = [...blocks];
          next.splice(idx + 1, 0, newBlock);
          onUpdate(next);
          setFocusedId(newBlock.id);
        }
      } else {
        // Was the default empty block not in state yet
        const nonChecklist = blocks.filter((b) => b.type !== "checklist");
        const checklists = blocks.filter((b) => b.type === "checklist");
        onUpdate([...nonChecklist, newBlock, ...checklists]);
        setFocusedId(newBlock.id);
      }
    },
    [blocks, onUpdate, slashState]
  );

  const handleAddBlock = useCallback(() => {
    const newBlock: ContentBlock = { id: uid(), type: "paragraph", text: "" };
    const checklists = blocks.filter((b) => b.type === "checklist");
    const rest = blocks.filter((b) => b.type !== "checklist");
    onUpdate([...rest, newBlock, ...checklists]);
    setFocusedId(newBlock.id);
  }, [blocks, onUpdate]);

  // Close slash menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSlashState(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="space-y-1">
        {displayBlocks.map((block) => {
          const isFocused = focusedId === block.id;
          const isSlashTarget = slashState?.blockId === block.id;

          return (
            <div key={block.id} className="relative">
              <BlockRow
                block={block}
                readOnly={readOnly}
                isFocused={isFocused}
                onFocus={() => setFocusedId(block.id)}
                onUpdate={(updated) => {
                  // Check if we should sync the default block into state
                  const isDefaultBlock = !blocks.find((b) => b.id === updated.id);
                  if (isDefaultBlock) {
                    const checklists = blocks.filter((b) => b.type === "checklist");
                    const rest = blocks.filter((b) => b.type !== "checklist");
                    onUpdate([...rest, updated, ...checklists]);
                  } else {
                    updateBlock(updated);
                  }
                }}
                onDelete={() => deleteBlock(block.id)}
                onInsertAfter={(type) => insertAfter(block.id, type)}
                onSlashTrigger={(query) => handleSlashTrigger(block.id, query)}
              />
              {isSlashTarget && !readOnly && (
                <SlashMenu
                  query={slashState!.query}
                  onSelect={handleSlashSelect}
                  onClose={() => setSlashState(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={handleAddBlock}
          className="mt-1 w-full text-left text-[10px] text-slate-700 hover:text-slate-500 transition-colors py-0.5 px-1 rounded hover:bg-slate-900/40"
        >
          + add block
        </button>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createBlock(type: ContentBlock["type"]): ContentBlock {
  const id = uid();
  switch (type) {
    case "heading":
      return { id, type: "heading", level: 2, text: "" };
    case "note":
      return { id, type: "note", text: "" };
    case "code":
      return { id, type: "code", text: "", language: "" };
    case "divider":
      return { id, type: "divider" };
    case "checklist":
      return { id, type: "checklist", items: [] };
    default:
      return { id, type: "paragraph", text: "" };
  }
}

// Extended create for heading levels
function createBlockFromSlash(type: SlashMenuType): ContentBlock {
  const id = uid();
  if (type === "heading1") return { id, type: "heading", level: 1, text: "" };
  if (type === "heading2") return { id, type: "heading", level: 2, text: "" };
  if (type === "heading3") return { id, type: "heading", level: 3, text: "" };
  return createBlock(type as ContentBlock["type"]);
}
