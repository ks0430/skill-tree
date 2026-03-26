import type { NodeContent, ChecklistBlock, ChecklistItem, NoteBlock } from "@/types/node-content";

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

// ── Note helpers ──────────────────────────────────────────────────────────────

export function getNote(content: NodeContent): NoteBlock | null {
  return (content.blocks.find((b) => b.type === "note") as NoteBlock) ?? null;
}

export function upsertNote(content: NodeContent, text: string): NodeContent {
  const existing = getNote(content);
  if (existing) {
    return {
      blocks: content.blocks.map((b) =>
        b.type === "note" ? { ...b, text } : b
      ),
    };
  }
  const block: NoteBlock = { id: uid(), type: "note", text };
  return { blocks: [...content.blocks, block] };
}

export function removeNote(content: NodeContent): NodeContent {
  return { blocks: content.blocks.filter((b) => b.type !== "note") };
}

// ── Generic block text update ─────────────────────────────────────────────────

/** Update the `text` field of any block that has one (paragraph, heading, note, code). */
export function updateBlockText(content: NodeContent, blockId: string, text: string): NodeContent {
  return {
    blocks: content.blocks.map((b) => {
      if (b.id !== blockId) return b;
      if (b.type === "divider" || b.type === "checklist") return b;
      return { ...b, text };
    }),
  };
}
