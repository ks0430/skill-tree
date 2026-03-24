import type { NodeContent, ChecklistBlock, ChecklistItem } from "@/types/node-content";

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function emptyContent(): NodeContent {
  return { blocks: [] };
}

export function parseContent(raw: unknown): NodeContent {
  if (raw && typeof raw === "object" && "blocks" in raw) return raw as NodeContent;
  return emptyContent();
}

export function getChecklist(content: NodeContent): ChecklistBlock | null {
  return (content.blocks.find((b) => b.type === "checklist") as ChecklistBlock) ?? null;
}

export function upsertChecklist(content: NodeContent, items: ChecklistItem[], title?: string): NodeContent {
  const existing = getChecklist(content);
  if (existing) {
    return {
      blocks: content.blocks.map((b) =>
        b.type === "checklist" ? { ...b, items, ...(title !== undefined && { title }) } : b
      ),
    };
  }
  const block: ChecklistBlock = {
    id: uid(),
    type: "checklist",
    items,
    ...(title && { title }),
  };
  return { blocks: [...content.blocks, block] };
}

export function toggleItem(content: NodeContent, itemId: string): NodeContent {
  return {
    blocks: content.blocks.map((b) =>
      b.type === "checklist"
        ? { ...b, items: b.items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i)) }
        : b
    ),
  };
}

export function addItem(content: NodeContent, text: string): NodeContent {
  const item: ChecklistItem = { id: uid(), text, checked: false };
  const existing = getChecklist(content);
  if (existing) {
    return upsertChecklist(content, [...existing.items, item]);
  }
  return upsertChecklist(content, [item]);
}

export function removeItem(content: NodeContent, itemId: string): NodeContent {
  return {
    blocks: content.blocks.map((b) =>
      b.type === "checklist" ? { ...b, items: b.items.filter((i) => i.id !== itemId) } : b
    ),
  };
}
