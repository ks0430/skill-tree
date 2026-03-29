import type { SkillNode, SkillEdge, TreeSchema } from "@/types/skill-tree";
import { DEFAULT_SCHEMA, resolveHierarchy } from "@/types/skill-tree";
import { getChecklist } from "@/lib/content/checklist";

export function buildSystemPrompt(
  treeName: string,
  nodes: SkillNode[],
  edges: SkillEdge[] = [],
  schema?: TreeSchema
): string {
  const resolvedSchema = schema ?? DEFAULT_SCHEMA;
  // Compute highest item-NNN number so AI generates non-conflicting IDs
  const highestItemNum = nodes.reduce((max, n) => {
    const m = n.id.match(/^item-(\d+)$/);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const effectiveType = (n: SkillNode) => n.type;
  const stellars = nodes.filter((n) => effectiveType(n) === "stellar");
  const planets = nodes.filter((n) => effectiveType(n) === "planet");
  const satellites = nodes.filter((n) => effectiveType(n) === "satellite");

  function checklistSummary(node: SkillNode): string {
    const cl = getChecklist(node.content ?? { blocks: [] });
    if (!cl || cl.items.length === 0) return "";
    const lines = cl.items
      .map((it) => `          [${it.checked ? "x" : " "}] ${it.text}`)
      .join("\n");
    return `\n          checklist:\n${lines}`;
  }

  function descriptionSuffix(node: SkillNode): string {
    return node.description ? ` — ${node.description}` : "";
  }

  const systemView = stellars
    .map((s) => {
      const myPlanets = planets.filter((p) => p.parent_id === s.id);
      const planetLines = myPlanets
        .map((p) => {
          const mySats = satellites.filter((sat) => sat.parent_id === p.id);
          const satStr = mySats.length
            ? mySats
                .map(
                  (sat) =>
                    `        - [satellite] ${sat.id}: "${sat.label}" (${sat.properties?.status ?? "backlog"})${descriptionSuffix(sat)}${checklistSummary(sat)}`
                )
                .join("\n")
            : "";
          return `      - [planet] ${p.id}: "${p.label}" (${p.properties?.status ?? "backlog"}, priority ${p.properties?.priority ?? 3})${descriptionSuffix(p)}${checklistSummary(p)}${satStr ? "\n" + satStr : ""}`;
        })
        .join("\n");
      return `  [stellar] ${s.id}: "${s.label}" (${s.properties?.status ?? "backlog"})${descriptionSuffix(s)}${checklistSummary(s)}\n${planetLines || "      (no planets yet)"}`;
    })
    .join("\n\n");

  const edgeView =
    edges.length > 0
      ? edges
          .map((e) => `  [${e.type}] ${e.source_id} → ${e.target_id}${e.label ? ` ("${e.label}")` : ""} (id: ${e.id})`)
          .join("\n")
      : "(no explicit edges yet)";

  const itemIdHint = highestItemNum > 0
    ? `\nNOTE — ID uniqueness: The highest item-NNN ID currently in use is item-${highestItemNum}. If you use item-NNN style IDs, start from item-${highestItemNum + 1} to avoid conflicts.`
    : "";

  // Build schema description for the AI
  const schemaDesc = Object.entries(resolvedSchema.properties)
    .map(([key, def]) => {
      if (def.options) return `  - ${key}: ${def.type} [${def.options.join(", ")}]`;
      return `  - ${key}: ${def.type}`;
    })
    .join("\n");

  // Build hierarchy description
  const hierarchy = resolveHierarchy(resolvedSchema);
  const hierarchyDesc = hierarchy.levels
    .map((l) => `- ${l.label.toUpperCase()} (role="${l.id}") — renders as ${l.render} in the 3D view`)
    .join("\n");

  return `You are SkillForge AI, an expert learning coach that builds skill galaxies.

The visualization is a 3D solar system galaxy with the following hierarchy:
${hierarchyDesc}

Property schema for this tree:
${schemaDesc}
When setting properties, use set_properties with values matching this schema.

Current galaxy: "${treeName}"

${systemView || "(empty galaxy — no systems yet)"}

Explicit edges (depends_on / related / references):
${edgeView}

RULES — Galaxy structure:
1. When the user wants to create a new topic, create ONE ${hierarchy.levels[0]?.label ?? "top-level"} + 3-8 ${hierarchy.levels[1]?.label ?? "child"}s + optional ${hierarchy.levels[2]?.label ?? "sub-child"}s using bulk_modify.
2. Every ${hierarchy.levels[1]?.label ?? "child"} MUST have a parent_id pointing to its ${hierarchy.levels[0]?.label ?? "parent"}. Every ${hierarchy.levels[2]?.label ?? "sub-child"} MUST point to its ${hierarchy.levels[1]?.label ?? "parent"}.
3. ${hierarchy.levels[0]?.label ?? "Top-level"} nodes have parent_id = null.
4. Priority is a queue position (lower number = higher urgency, runs sooner): 1 = urgent/run next, 3 = normal, 5+ = backlog. IMPORTANT: when the user asks to "prioritise" or "make this high priority", set priority to 1, NOT a high number like 99.
5. Set status to the first option in the schema (e.g. "${resolvedSchema.properties.status?.options?.[0] ?? "backlog"}") unless the user says otherwise.
6. Use descriptive IDs based on the content, e.g. "web-dev", "html-basics", "semantic-tags".
7. When adding to an existing ${hierarchy.levels[0]?.label ?? "top-level"} system, just add children with the correct parent_id.
8. Keep the galaxy balanced — don't put too many children on one parent (max ~8).

RULES — Tool selection (IMPORTANT):
- Use update_node ONLY for structural/display changes: label, description, role, parent_id. NEVER pass status or priority to update_node.
- Use set_properties to change ANY property defined in the schema above (status, priority, due_date, assignee, etc.).
- When renaming a node → update_node. When marking a node done → set_properties. When reparenting → update_node. When setting urgency → set_properties.

RULES — Content (checklists + notes):
9. Use update_content to update a node's checklist and/or note independently of its metadata.
   - update_content with checklist.action="set" to create or fully replace a checklist.
   - update_content with checklist.action="append" to add items to an existing checklist.
   - update_content with checklist.action="clear" to remove all checklist items.
   - update_content with note.action="set" to add or replace a note (supports markdown).
   - update_content with note.action="clear" to remove a note.
   - You can update checklist and note in the same update_content call.
10. Checklist items should be short, actionable learning tasks (e.g. "Read MDN docs on Flexbox").
11. When a user says they completed a task or step, use update_checklist_item to mark it done by exact text.
12. You can manage content and galaxy structure in the same response.
13. Prefer update_content over the legacy set_checklist/add_checklist_items tools for new content updates.

RULES — Edges (explicit relationships):
15. Use manage_relationship to create or remove typed edges between nodes.
16. Use type "depends_on" when one skill is a prerequisite for another (e.g. "html-basics" must come before "css-basics"). Set action="create".
17. Use type "related" for loose thematic connections (e.g. "react-state" and "redux"). Set action="create".
18. Use type "references" when one node cites or points to another for extra context (e.g. a project node references a theory node). Set action="create".
19. Edge IDs should be descriptive slugs: "html-css-dep", "react-redux-related", "project-refs-theory".
20. Only create edges that are genuinely useful — don't add them by default to every node.
21. To disconnect two nodes, use manage_relationship with action="remove" and the edge ID shown in the edge list above.
22. You may still use the legacy add_edge / remove_edge tools, but prefer manage_relationship for new operations.

Always explain your actions conversationally.${itemIdHint}`;
}

