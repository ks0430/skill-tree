export type NodeStatus = "locked" | "in_progress" | "completed";
export type NodeRole = "stellar" | "planet" | "satellite";
/** Canonical node type (replaces role). Seeded from role; user-extensible in future. */
export type NodeType = NodeRole; // union may expand later

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
  /** Canonical column (added in migration 004). Prefer over role. */
  type: NodeType;
  /** Legacy column kept for backward compatibility — mirrors type. */
  role: NodeRole;
  parent_id: string | null; // stellar has null, planet → stellar id, satellite → planet id
  priority: number;
  position_x: number; // unused for layout, kept for AI ordering hint
  position_y: number;
  icon: string | null;
  metadata: Record<string, unknown> | null;
  content: import("./node-content").NodeContent;
}

/** Edge relationship type (added in migration 004). */
export type EdgeType = "parent" | "depends_on" | "blocks" | "related" | "references";

// Edges represent explicit relationships between nodes (supplementary to orbital hierarchy)
export interface SkillEdge {
  id: string;
  tree_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  type: EdgeType;
  weight: number;
  metadata: Record<string, unknown> | null;
}
