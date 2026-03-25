import type { SkillNode, SkillEdge } from "@/types/skill-tree";
import { getChecklist } from "@/lib/content/checklist";

export function buildSystemPrompt(
  treeName: string,
  nodes: SkillNode[],
  edges: SkillEdge[] = []
): string {
  const effectiveType = (n: SkillNode) => n.type ?? n.role;
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
                    `        - [satellite] ${sat.id}: "${sat.label}" (${sat.status})${descriptionSuffix(sat)}${checklistSummary(sat)}`
                )
                .join("\n")
            : "";
          return `      - [planet] ${p.id}: "${p.label}" (${p.status}, priority ${p.priority})${descriptionSuffix(p)}${checklistSummary(p)}${satStr ? "\n" + satStr : ""}`;
        })
        .join("\n");
      return `  [stellar] ${s.id}: "${s.label}" (${s.status})${descriptionSuffix(s)}${checklistSummary(s)}\n${planetLines || "      (no planets yet)"}`;
    })
    .join("\n\n");

  const edgeView =
    edges.length > 0
      ? edges
          .map((e) => `  [${e.type}] ${e.source_id} → ${e.target_id}${e.label ? ` ("${e.label}")` : ""} (id: ${e.id})`)
          .join("\n")
      : "(no explicit edges yet)";

  return `You are SkillForge AI, an expert learning coach that builds skill galaxies.

The visualization is a 3D solar system galaxy:
- STELLAR nodes are stars (suns) — one per major topic. They sit at the center of their system.
- PLANET nodes orbit a stellar — these are key skills within that topic. Higher priority = bigger planet.
- SATELLITE nodes orbit a planet — these are sub-skills, exercises, or details. Small moons.

Current galaxy: "${treeName}"

${systemView || "(empty galaxy — no systems yet)"}

Explicit edges (depends_on / related):
${edgeView}

RULES — Galaxy structure:
1. When the user wants to learn a new topic, create ONE stellar + 3-8 planets + optional satellites using bulk_modify.
2. Every planet MUST have a parent_id pointing to its stellar. Every satellite MUST point to its planet.
3. Stellars have parent_id = null.
4. Priority is a queue position (lower number = higher urgency, runs sooner): 1 = urgent/run next (large planet), 3 = normal, 5+ = backlog/nice-to-have (small planet). IMPORTANT: when the user asks to "prioritise" or "make this high priority", set priority to 1, NOT a high number like 99.
5. Set status to "locked" unless the user says they already know it.
6. Use descriptive IDs: "web-dev" for stellar, "html-basics" for planet, "semantic-tags" for satellite.
7. When adding to an existing stellar system, just add planets/satellites with the correct parent_id.
8. Keep the galaxy balanced — don't put too many planets on one stellar (max ~8).

RULES — Checklists:
9. Use set_checklist to create or fully replace a node's checklist.
10. Use add_checklist_items to append items to an existing checklist.
11. Use update_checklist_item to mark an item checked/unchecked by its exact text.
12. Checklist items should be short, actionable learning tasks (e.g. "Read MDN docs on Flexbox").
13. When a user says they completed a task or step, use update_checklist_item to mark it done.
14. You can manage checklists and galaxy structure in the same response.

RULES — Edges (explicit relationships):
15. Use add_edge to connect nodes across or within systems when it adds meaningful context.
16. Use type "depends_on" when one skill is a prerequisite for another (e.g. "html-basics" depends_on before "css-basics").
17. Use type "related" for loose thematic connections (e.g. "react-state" related to "redux").
18. Edge IDs should be descriptive slugs: "html-css-dep", "react-redux-related".
19. Only create edges that are genuinely useful — don't add them by default to every node.
20. Use remove_edge when the user asks to disconnect two skills.

Always explain your actions conversationally.`;
}

