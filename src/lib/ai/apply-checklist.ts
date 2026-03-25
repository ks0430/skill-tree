import type { ToolCall } from "@/types/chat";
import type { NodeContent, ChecklistItem } from "@/types/node-content";
import { parseContent, upsertChecklist, getChecklist, upsertNote, removeNote } from "@/lib/content/checklist";

function uid(i: number): string {
  return Math.random().toString(36).slice(2, 10) + i;
}

export const checklistToolNames = new Set([
  "update_content",
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

  if (name === "update_content") {
    let content = existingContent;

    // Apply checklist changes if provided
    const cl = input.checklist as { action: string; items?: Array<{ text: string; checked?: boolean }> } | undefined;
    if (cl) {
      if (cl.action === "set") {
        const rawItems = cl.items ?? [];
        const items: ChecklistItem[] = rawItems.map((it, i) => ({
          id: uid(i),
          text: it.text,
          checked: it.checked ?? false,
          ai_generated: true,
        }));
        content = upsertChecklist({ ...content, blocks: content.blocks.filter((b) => b.type !== "checklist") }, items);
      } else if (cl.action === "append") {
        const rawItems = cl.items ?? [];
        const newItems: ChecklistItem[] = rawItems.map((it, i) => ({
          id: uid(i),
          text: it.text,
          checked: it.checked ?? false,
          ai_generated: true,
        }));
        const existing = getChecklist(content)?.items ?? [];
        content = upsertChecklist(content, [...existing, ...newItems]);
      } else if (cl.action === "clear") {
        content = { blocks: content.blocks.filter((b) => b.type !== "checklist") };
      }
    }

    // Apply note changes if provided
    const note = input.note as { action: string; text?: string } | undefined;
    if (note) {
      if (note.action === "set" && note.text !== undefined) {
        content = upsertNote(content, note.text);
      } else if (note.action === "clear") {
        content = removeNote(content);
      }
    }

    return content;
  }

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
