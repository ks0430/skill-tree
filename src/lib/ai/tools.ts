import type { Tool } from "@anthropic-ai/sdk/resources/messages";

const propertyTools: Tool[] = [
  {
    name: "update_properties",
    description:
      "Update structured metadata properties of a skill node: due_date, assignee, priority (queue position), and/or status. Use this when the user wants to assign a deadline, assign ownership, change urgency/priority, or mark a node's status — without modifying its description or content blocks.",
    input_schema: {
      type: "object" as const,
      properties: {
        node_id: { type: "string", description: "ID of the skill node to update" },
        due_date: {
          type: "string",
          description: "ISO 8601 date string (e.g. '2025-12-31') for when this skill/task should be completed. Set to null to clear.",
        },
        assignee: {
          type: "string",
          description: "Name or identifier of the person responsible for this node. Set to null to clear.",
        },
        priority: {
          type: "number",
          description: "Priority level 1–5 (higher = more important = larger planet in galaxy view). Whole numbers only.",
          minimum: 1,
          maximum: 5,
        },
        status: {
          type: "string",
          enum: ["locked", "in_progress", "completed"],
          description: "Current status of the skill node.",
        },
      },
      required: ["node_id"],
    },
  },
];

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

export const skillTreeTools: Tool[] = [
  ...propertyTools,
  ...contentTools,
  ...checklistTools,
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
        status: {
          type: "string",
          enum: ["locked", "in_progress", "completed"],
          description: "Initial status",
        },
        priority: { type: "number", description: "1-5, higher = more important = larger planet" },
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
    description: "Update properties of an existing node.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID of the node to update" },
        label: { type: "string" },
        description: { type: "string" },
        role: { type: "string", enum: ["stellar", "planet", "satellite"] },
        parent_id: { type: "string" },
        status: { type: "string", enum: ["locked", "in_progress", "completed"] },
        priority: { type: "number" },
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
  {
    name: "add_edge",
    description:
      "Create an explicit relationship edge between two skill nodes. Use 'depends_on' when one skill must be learned before another (e.g. HTML depends_on before CSS makes sense). Use 'related' for loose thematic connections between skills in different systems.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Unique ID slug for the edge, e.g. 'html-to-css-dep'" },
        source_id: { type: "string", description: "ID of the source node (the node that depends on or is related to the target)" },
        target_id: { type: "string", description: "ID of the target node" },
        type: {
          type: "string",
          enum: ["depends_on", "related"],
          description: "depends_on = source must be learned before target; related = loose thematic connection",
        },
        label: { type: "string", description: "Optional short label describing the relationship" },
        weight: { type: "number", description: "Relationship strength 0.1–1.0, default 1.0" },
      },
      required: ["id", "source_id", "target_id", "type"],
    },
  },
  {
    name: "remove_edge",
    description: "Remove an explicit relationship edge between two nodes by its ID.",
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
      "Create or remove typed relationship edges between two skill nodes. Use this as the primary way to manage explicit connections. Supports depends_on (prerequisite ordering), related (loose thematic connection), and references (one node cites or points to another for more context).",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["create", "remove"],
          description: "create = add a new edge; remove = delete an existing edge by ID",
        },
        id: {
          type: "string",
          description: "Edge ID slug. For create: a unique descriptive slug e.g. 'html-css-dep'. For remove: the ID of the existing edge to delete.",
        },
        source_id: {
          type: "string",
          description: "ID of the source node. Required for create.",
        },
        target_id: {
          type: "string",
          description: "ID of the target node. Required for create.",
        },
        type: {
          type: "string",
          enum: ["depends_on", "related", "references"],
          description:
            "depends_on = source is a prerequisite of target (learn source before target); related = loose thematic connection; references = source node cites or links to target for additional context. Required for create.",
        },
        label: {
          type: "string",
          description: "Optional short label describing the relationship (e.g. 'prerequisite', 'see also').",
        },
        weight: {
          type: "number",
          description: "Relationship strength 0.1–1.0, default 1.0. Only used for create.",
        },
      },
      required: ["action", "id"],
    },
  },
];
