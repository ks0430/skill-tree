export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  ai_generated?: boolean;
}

export interface ChecklistBlock {
  id: string;
  type: "checklist";
  title?: string;
  items: ChecklistItem[];
}

export interface NoteBlock {
  id: string;
  type: "note";
  text: string;
}

// Union for future block types (links, etc.)
export type ContentBlock = ChecklistBlock | NoteBlock;

export interface NodeContent {
  blocks: ContentBlock[];
}
