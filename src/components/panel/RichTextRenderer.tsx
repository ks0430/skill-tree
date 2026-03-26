"use client";

import type { ContentBlock, ChecklistItem } from "@/types/node-content";

interface RichTextRendererProps {
  blocks: ContentBlock[];
  /** Checklist interaction handlers — if omitted, checklist is rendered read-only */
  onToggle?: (itemId: string) => void;
}

function ChecklistRow({
  item,
  onToggle,
}: {
  item: ChecklistItem;
  onToggle?: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs group">
      {onToggle ? (
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
            item.checked
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-slate-600 hover:border-slate-400"
          }`}
          aria-label={item.checked ? "Uncheck item" : "Check item"}
        >
          {item.checked && (
            <svg
              viewBox="0 0 10 10"
              className="w-2.5 h-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <polyline points="1.5,5 4,7.5 8.5,2.5" />
            </svg>
          )}
        </button>
      ) : (
        <span className={item.checked ? "text-emerald-400" : "text-slate-500"}>
          {item.checked ? "✓" : "○"}
        </span>
      )}
      <span
        className={
          item.checked ? "line-through text-slate-500" : "text-slate-300"
        }
      >
        {item.text}
      </span>
    </div>
  );
}

export function RichTextRenderer({ blocks, onToggle }: RichTextRendererProps) {
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

          case "checklist": {
            const items = block.items ?? [];
            if (items.length === 0) return null;
            const done = items.filter((i) => i.checked).length;
            return (
              <div key={block.id} className="space-y-1 pt-1">
                {block.title && (
                  <p className="text-xs font-medium text-slate-400 mb-1">
                    {block.title}
                    <span className="ml-1 text-slate-500">
                      ({done}/{items.length})
                    </span>
                  </p>
                )}
                {items.map((item) => (
                  <ChecklistRow key={item.id} item={item} onToggle={onToggle} />
                ))}
              </div>
            );
          }

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
