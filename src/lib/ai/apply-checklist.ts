import type { ToolCall } from "@/types/chat";
import type { NodeContent, ChecklistItem } from "@/types/node-content";
import { parseContent, upsertChecklist, getChecklist } from "@/lib/content/checklist";

function uid(i: number): string {
  return Math.random().toString(36).slice(2, 10) + i;
}

export const checklistToolNames = new Set([
  "set_checklist",
  "add_checklist_items",
  "update_checklist_item",
]);

/**
 * Returns the updated NodeContent for a checklist tool call,
 * or null if the tool name isn't a checklist tool.
 */
export function applyChecklistTool(
  toolCall: ToolCall,
  existingContent: NodeContent
): NodeContent | null {
  const { name, input } = toolCall;

  if (name === "set_checklist") {
    const rawItems = (input.items as Array<{ text: string; checked?: boolean }>) ?? [];
    const items: ChecklistItem[] = rawItems.map((it, i) => ({
      id: uid(i),
      text: it.text,
      checked: it.checked ?? false,
      ai_generated: true,
    }));
    return upsertChecklist({ blocks: [] }, items); // full replace
  }

  if (name === "add_checklist_items") {
    const rawItems = (input.items as Array<{ text: string }>) ?? [];
    const newItems: ChecklistItem[] = rawItems.map((it, i) => ({
      id: uid(i),
      text: it.text,
      checked: false,
      ai_generated: true,
    }));
    const existing = getChecklist(existingContent)?.items ?? [];
    return upsertChecklist(existingContent, [...existing, ...newItems]);
  }

  if (name === "update_checklist_item") {
    const itemText = input.item_text as string;
    const checked = input.checked as boolean;
    const existing = getChecklist(existingContent);
    if (!existing) return existingContent;
    const updated: ChecklistItem[] = existing.items.map((it) =>
      it.text === itemText ? { ...it, checked } : it
    );
    return upsertChecklist(existingContent, updated);
  }

  return null;
}
