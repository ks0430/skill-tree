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

export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  text: string;
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface CodeBlock {
  id: string;
  type: "code";
  language?: string;
  text: string;
}

export interface DividerBlock {
  id: string;
  type: "divider";
}

// Union for future block types (links, etc.)
export type ContentBlock = ChecklistBlock | NoteBlock | ParagraphBlock | HeadingBlock | CodeBlock | DividerBlock;

export interface NodeContent {
  blocks: ContentBlock[];
}
