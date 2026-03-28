import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { TreeSchema } from "@/types/skill-tree";
import { DEFAULT_SCHEMA } from "@/types/skill-tree";

/** Build a description of valid properties from the tree schema for tool descriptions. */
function describeProperties(schema: TreeSchema): string {
  return Object.entries(schema.properties)
    .map(([key, def]) => {
      if (def.options) return `${key} (${def.type}: ${def.options.join(", ")})`;
      return `${key} (${def.type})`;
    })
    .join("; ");
}

function buildPropertyTools(schema: TreeSchema): Tool[] {
  // Build properties schema for the tool input
  const propSchema: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema.properties)) {
    if (def.type === "select") {
      propSchema[key] = { type: "string", enum: def.options, description: `${key} (select)` };
    } else if (def.type === "multi_select") {
      propSchema[key] = { type: "array", items: { type: "string", enum: def.options }, description: `${key} (multi-select)` };
    } else if (def.type === "number") {
      propSchema[key] = { type: "number", description: `${key} (number)` };
    } else if (def.type === "date") {
      propSchema[key] = { type: "string", description: `${key} (ISO date string, e.g. '2025-12-31')` };
    } else if (def.type === "checkbox") {
      propSchema[key] = { type: "boolean", description: `${key} (checkbox)` };
    } else {
      propSchema[key] = { type: "string", description: `${key} (text)` };
    }
  }

  return [
    {
      name: "set_properties",
      description: `Set one or more properties on a node. Available properties: ${describeProperties(schema)}. Pass only the properties you want to change.`,
      input_schema: {
        type: "object" as const,
        properties: {
          node_id: { type: "string", description: "ID of the skill node to update" },
          properties: {
            type: "object",
            description: "Key-value pairs of properties to set. Keys must match the tree schema.",
            properties: propSchema,
          },
        },
        required: ["node_id", "properties"],
      },
    },
  ];
}

const contentTools: Tool[] = [
  {
    name: "update_content",
    description:
      "Update a node's content blocks (checklist items and/or notes) independently of node metadata. Use this when the user wants to add, replace, or clear a node's checklist or note without changing other properties like label, status, or description.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "ID of the skill node to update" },
        checklist: {
          type: "object",
          description: "Checklist update. Omit to leave checklist unchanged.",
          properties: {
            action: {
              type: "string",
              enum: ["set", "append", "clear"],
              description: "set = replace entire checklist; append = add items to existing; clear = remove all items",
            },
            items: {
              type: "array",
              description: "Items to set or append. Required for 'set' and 'append' actions.",
              items: {
                type: "object",
                properties: {
                  text: { type: "string", description: "Checklist item text (short, actionable)" },
                  checked: { type: "boolean", description: "Initial checked state, default false" },
                },
                required: ["text"],
              },
            },
          },
          required: ["action"],
        },
        note: {
          type: "object",
          description: "Note update. Omit to leave note unchanged.",
          properties: {
            action: {
              type: "string",
              enum: ["set", "clear"],
              description: "set = create or replace note text; clear = remove note",
            },
            text: { type: "string", description: "Note content (markdown supported). Required for 'set' action." },
          },
          required: ["action"],
        },
      },
      required: ["node_id"],
    },
  },
];

const checklistTools: Tool[] = [
  {
    name: "set_checklist",
    description: "Create or fully replace a node's checklist. Use when the user wants a fresh checklist for a skill.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "ID of the skill node" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "Checklist item text (short, actionable)" },
              checked: { type: "boolean", description: "Initial checked state, default false" },
            },
            required: ["text"],
          },
        },
      },
      required: ["node_id", "items"],
    },
  },
  {
    name: "add_checklist_items",
    description: "Append new items to a node's existing checklist without replacing existing ones.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "ID of the skill node" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
            },
            required: ["text"],
          },
        },
      },
      required: ["node_id", "items"],
    },
  },
  {
    name: "update_checklist_item",
    description: "Mark a checklist item as checked or unchecked, matched by its exact text.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "ID of the skill node" },
        item_text: { type: "string", description: "Exact text of the item to update" },
        checked: { type: "boolean", description: "New checked state" },
      },
      required: ["node_id", "item_text", "checked"],
    },
  },
];

function buildStructureTools(schema: TreeSchema): Tool[] {
  const statusOptions = schema.properties.status?.options;
  const statusSchema = statusOptions
    ? { type: "string" as const, enum: statusOptions, description: "Initial status" }
    : { type: "string" as const, description: "Initial status" };

  return [
    {
      name: "add_node",
      description:
        "Add a skill node to the galaxy. Stellar = main topic (sun at center of a system). Planet = important skill (orbits a stellar). Satellite = sub-skill or detail (orbits a planet).",
      input_schema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "Unique ID slug, e.g. 'html-basics'" },
          label: { type: "string", description: "Display name" },
          description: { type: "string", description: "1-2 sentence description" },
          role: {
            type: "string",
            enum: ["stellar", "planet", "satellite"],
            description: "stellar = main topic (star), planet = key skill (orbits a star), satellite = sub-skill (orbits a planet)",
          },
          parent_id: {
            type: "string",
            description: "ID of the parent node. null for stellar. For planet: the stellar ID. For satellite: the planet ID.",
          },
          status: statusSchema,
          priority: { type: "number", description: "1-5, higher = more important = larger planet" },
          properties: {
            type: "object",
            description: "Optional initial property values matching the tree schema.",
          },
        },
        required: ["id", "label", "description", "role"],
      },
    },
    {
      name: "remove_node",
      description: "Remove a node and all its children from the galaxy.",
      input_schema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "ID of the node to remove" },
        },
        required: ["id"],
      },
    },
    {
      name: "update_node",
      description:
        "Update the structural or display properties of an existing node: label, description, role, or parent_id. Use this ONLY for structural/display changes. Use set_properties for status, priority, and other metadata.",
      input_schema: {
        type: "object" as const,
        properties: {
          id: { type: "string", description: "ID of the node to update" },
          label: { type: "string", description: "New display name for the node" },
          description: { type: "string", description: "New 1-2 sentence description" },
          role: { type: "string", enum: ["stellar", "planet", "satellite"], description: "New role" },
          parent_id: { type: "string", description: "New parent node ID" },
        },
        required: ["id"],
      },
    },
    {
      name: "bulk_modify",
      description:
        "Apply multiple operations at once. Always use this when creating a new topic system (stellar + planets + satellites).",
      input_schema: {
        type: "object" as const,
        properties: {
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["add_node", "remove_node", "update_node"],
                },
                params: { type: "object" },
              },
              required: ["action", "params"],
            },
            description: "Array of operations",
          },
        },
        required: ["operations"],
      },
    },
  ];
}

const edgeTools: Tool[] = [
  {
    name: "add_edge",
    description:
      "Create an explicit relationship edge between two skill nodes.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Unique ID slug for the edge" },
        source_id: { type: "string", description: "ID of the source node" },
        target_id: { type: "string", description: "ID of the target node" },
        type: {
          type: "string",
          enum: ["depends_on", "related"],
          description: "depends_on = prerequisite; related = loose connection",
        },
        label: { type: "string", description: "Optional short label" },
        weight: { type: "number", description: "Strength 0.1–1.0, default 1.0" },
      },
      required: ["id", "source_id", "target_id", "type"],
    },
  },
  {
    name: "remove_edge",
    description: "Remove an explicit relationship edge by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the edge to remove" },
      },
      required: ["id"],
    },
  },
  {
    name: "manage_relationship",
    description:
      "Create or remove typed relationship edges between two skill nodes.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["create", "remove"] },
        id: { type: "string", description: "Edge ID slug" },
        source_id: { type: "string", description: "Source node ID (for create)" },
        target_id: { type: "string", description: "Target node ID (for create)" },
        type: { type: "string", enum: ["depends_on", "related", "references"], description: "Edge type (for create)" },
        label: { type: "string", description: "Optional label" },
        weight: { type: "number", description: "Strength 0.1–1.0 (for create)" },
      },
      required: ["action", "id"],
    },
  },
];

/** Build tools dynamically from tree schema. */
export function buildTools(schema?: TreeSchema): Tool[] {
  const s = schema ?? DEFAULT_SCHEMA;
  return [
    ...buildPropertyTools(s),
    ...contentTools,
    ...checklistTools,
    ...buildStructureTools(s),
    ...edgeTools,
  ];
}

/** @deprecated Use buildTools(schema) instead. Kept for backward compatibility. */
export const skillTreeTools: Tool[] = buildTools(DEFAULT_SCHEMA);
