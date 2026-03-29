// ── Property schema types (tree-level) ──────────────────────────────────────

export type PropertyType = "select" | "multi_select" | "text" | "number" | "date" | "checkbox";

export interface PropertyDef {
  type: PropertyType;
  options?: string[]; // for select / multi_select
}

// ── Hierarchy types ─────────────────────────────────────────────────────────

/** 3D rendering style — maps to solar system visual tier. */
export type HierarchyRender = "star" | "planet" | "satellite";

export interface HierarchyLevel {
  id: string;          // stored in node's type column, e.g. "epic", "story", "task"
  label: string;       // display name, e.g. "Epic", "Story", "Task"
  render: HierarchyRender; // how to render in 3D view
}

export interface HierarchyConfig {
  levels: HierarchyLevel[];
  /** Depth index from which nodes appear as cards on the board (default 1 = skip top level). */
  card_from: number;
}

export interface TreeSchema {
  properties: Record<string, PropertyDef>;
  hierarchy?: HierarchyConfig;
}

// ── View config types ───────────────────────────────────────────────────────

export type ViewType = "solar_system" | "kanban" | "gantt";

export interface ViewConfig {
  id: string;
  name: string;
  type: ViewType;
  group_by?: string;   // property key for kanban grouping
  date_field?: string;  // property key for gantt date
  filters?: Array<{ property: string; operator: string; value: unknown }>;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  phase_grouping?: boolean; // timeline: show phase sub-groups within date sections
}

// ── Default schema & views (mirrors legacy hardcoded behavior) ──────────────

export const DEFAULT_HIERARCHY: HierarchyConfig = {
  levels: [
    { id: "stellar",   label: "Stellar",   render: "star" },
    { id: "planet",    label: "Planet",     render: "planet" },
    { id: "satellite", label: "Satellite",  render: "satellite" },
  ],
  card_from: 1,
};

export const DEFAULT_SCHEMA: TreeSchema = {
  properties: {
    status: { type: "select", options: ["backlog", "queued", "in_progress", "completed"] },
    priority: { type: "number" },
    due_date: { type: "date" },
    assignee: { type: "text" },
  },
  hierarchy: DEFAULT_HIERARCHY,
};

export const DEFAULT_VIEW_CONFIGS: ViewConfig[] = [
  { id: "solar",  name: "Solar System", type: "solar_system" },
  { id: "kanban", name: "Board",        type: "kanban", group_by: "status" },
  { id: "gantt",  name: "Timeline",     type: "gantt",  date_field: "due_date", group_by: "phase" },
];

// ── Status & node type aliases ──────────────────────────────────────────────

export type NodeStatus = "backlog" | "queued" | "in_progress" | "completed";
export type NodeType = string;

// ── Core data types ─────────────────────────────────────────────────────────

export interface SkillTree {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  theme: string | null;
  /** Property definitions for this tree. Falls back to DEFAULT_SCHEMA if empty. */
  schema?: TreeSchema;
  /** View configurations. Falls back to DEFAULT_VIEW_CONFIGS if empty. */
  view_configs?: ViewConfig[];
  created_at: string;
  updated_at: string;
}

export interface SkillNode {
  id: string;
  tree_id: string;
  label: string;
  description: string | null;
  /** Structural hierarchy tier (e.g. "stellar", "planet", "satellite" or custom). */
  type: NodeType;
  parent_id: string | null;
  icon: string | null;
  /** Source of truth for all dynamic fields (status, priority, dates, etc.). */
  properties: Record<string, unknown>;
  content: import("./node-content").NodeContent;
}

export type EdgeType = "parent" | "depends_on" | "blocks" | "related" | "references";

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

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Read a property from a node's properties bag. */
export function getNodeProperty(node: SkillNode, key: string): unknown {
  return node.properties?.[key];
}

/** Merge new properties into a node. Returns a partial update object. */
export function buildNodeUpdate(
  existing: SkillNode,
  newProps: Record<string, unknown>
): Partial<SkillNode> {
  return { properties: { ...existing.properties, ...newProps } };
}

/** Resolve tree schema with defaults for missing fields. */
export function resolveSchema(tree: SkillTree): TreeSchema {
  const schema = tree.schema;
  if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
    return DEFAULT_SCHEMA;
  }
  // Ensure hierarchy is present
  if (!schema.hierarchy) {
    return { ...schema, hierarchy: DEFAULT_HIERARCHY };
  }
  return schema;
}

/** Resolve hierarchy config from schema, with defaults. */
export function resolveHierarchy(schema: TreeSchema): HierarchyConfig {
  return schema.hierarchy ?? DEFAULT_HIERARCHY;
}

/** Get the render style for a node type (e.g. "epic" → "star"). */
export function getNodeRender(schema: TreeSchema, nodeType: string): HierarchyRender {
  const hierarchy = resolveHierarchy(schema);
  const level = hierarchy.levels.find((l) => l.id === nodeType);
  if (level) return level.render;
  // Legacy fallback
  if (nodeType === "stellar") return "star";
  if (nodeType === "satellite") return "satellite";
  return "planet";
}

/** Get the hierarchy level IDs (e.g. ["epic", "story", "task"]). */
export function getHierarchyIds(schema: TreeSchema): string[] {
  return resolveHierarchy(schema).levels.map((l) => l.id);
}

/** Get the top-level type ID (depth 0 — rendered as star, hidden from board). */
export function getTopLevelId(schema: TreeSchema): string {
  return resolveHierarchy(schema).levels[0]?.id ?? "stellar";
}

/** Check if a node type should appear as a card on the board. */
export function isCardType(schema: TreeSchema, nodeType: string): boolean {
  const hierarchy = resolveHierarchy(schema);
  const idx = hierarchy.levels.findIndex((l) => l.id === nodeType);
  if (idx === -1) return true; // unknown type → show as card
  return idx >= hierarchy.card_from;
}

/** Get the display label for a node type. */
export function getTypeLabel(schema: TreeSchema, nodeType: string): string {
  const hierarchy = resolveHierarchy(schema);
  const level = hierarchy.levels.find((l) => l.id === nodeType);
  return level?.label ?? nodeType;
}

/** Resolve view configs with defaults. */
export function resolveViewConfigs(tree: SkillTree): ViewConfig[] {
  const configs = tree.view_configs;
  if (!configs || configs.length === 0) return DEFAULT_VIEW_CONFIGS;
  return configs;
}
