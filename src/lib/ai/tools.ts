import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const skillTreeTools: Tool[] = [
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
];
