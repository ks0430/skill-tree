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

// Union for future block types (notes, links, etc.)
export type ContentBlock = ChecklistBlock;

export interface NodeContent {
  blocks: ContentBlock[];
}
