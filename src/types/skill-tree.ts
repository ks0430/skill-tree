export type NodeStatus = "locked" | "in_progress" | "completed";
export type NodeRole = "stellar" | "planet" | "satellite";

export interface SkillTree {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  theme: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillNode {
  id: string;
  tree_id: string;
  label: string;
  description: string | null;
  status: NodeStatus;
  role: NodeRole;
  parent_id: string | null; // stellar has null, planet → stellar id, satellite → planet id
  priority: number;
  position_x: number; // unused for layout, kept for AI ordering hint
  position_y: number;
  icon: string | null;
  metadata: Record<string, unknown> | null;
  content: import("./node-content").NodeContent;
}

// Edges are no longer used for rendering — orbital hierarchy replaces them
export interface SkillEdge {
  id: string;
  tree_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  metadata: Record<string, unknown> | null;
}
