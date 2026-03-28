import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  // Step 1: Create the tickets table via raw SQL
  const { error: createError } = await supabase.rpc("exec_sql", {
    query: `
      CREATE TABLE IF NOT EXISTS public.tickets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE,
        title text NOT NULL,
        description text,
        complexity integer DEFAULT 1,
        status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
        files text[] DEFAULT '{}',
        dependencies text[] DEFAULT '{}',
        acceptance_criteria text[] DEFAULT '{}',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `,
  });

  // If rpc doesn't exist, we need to create the table another way
  // For Supabase hosted, we can use the pg_net extension or just insert if table exists

  // Step 2: Insert tickets
  const tickets = [
    {
      key: "T1",
      title: "Filter state & logic (Zustand slice)",
      description: "Add filter state and a filteredNodes computed getter to the tree store. A filter is an array of {property, operator, value} conditions. All conditions are ANDed.",
      complexity: 2,
      status: "todo",
      files: ["src/lib/store/tree-store.ts", "src/types/skill-tree.ts"],
      dependencies: [],
      acceptance_criteria: [
        "New FilterCondition type: { property, operator: eq|neq|contains|gt|lt|in|is_empty, value }",
        "Store has filters[], setFilters(), addFilter(), removeFilter(), clearFilters()",
        "getFilteredNodes() selector returns nodes matching all active filters via getNodeProperty",
        "Operators work correctly per property type (select→eq/neq/in, number→gt/lt/eq, date→gt/lt, text→contains, checkbox→eq)",
        "Empty filters array returns all nodes",
      ],
    },
    {
      key: "T2",
      title: "FilterBar UI component",
      description: "A horizontal filter bar below the ViewSwitcher. Shows active filter chips and an '+ Add Filter' button. Each chip shows property name, operator, value and has an X to remove.",
      complexity: 3,
      status: "todo",
      files: ["src/components/canvas/FilterBar.tsx", "src/app/(app)/tree/[id]/page.tsx"],
      dependencies: ["T1"],
      acceptance_criteria: [
        "Renders below ViewSwitcher, above the active view",
        "Shows a chip per active filter with label like 'Status = In Progress'",
        "Each chip has an X button that calls removeFilter(index)",
        "'Clear all' button when 2+ filters active",
        "'+ Add Filter' button opens filter popover (T3)",
        "Reads property definitions from tree schema for human-readable labels",
        "Styled with Tailwind, matches existing dark theme",
      ],
    },
    {
      key: "T3",
      title: "Filter popover (add/edit filter)",
      description: "Popover triggered by '+ Add Filter' that lets the user pick a property, operator, and value. Property list comes from the tree schema. Value input adapts to property type.",
      complexity: 3,
      status: "todo",
      files: ["src/components/canvas/FilterPopover.tsx"],
      dependencies: ["T1", "T2"],
      acceptance_criteria: [
        "Step 1: dropdown of schema-defined properties (status, priority, due_date, assignee, + custom)",
        "Step 2: operator dropdown filtered to valid operators for chosen property type",
        "Step 3: value input — select for select properties, text for text, number for number, date for date, checkbox for checkbox",
        "'Apply' button adds filter to store",
        "Closes on apply or click-outside",
        "Keyboard accessible (Escape to close)",
      ],
    },
    {
      key: "T4",
      title: "Integrate filters with Kanban view",
      description: "Kanban view should only show cards that pass the active filters. Filtered-out nodes are hidden from columns.",
      complexity: 2,
      status: "todo",
      files: ["src/components/canvas/KanbanView.tsx"],
      dependencies: ["T1"],
      acceptance_criteria: [
        "Uses getFilteredNodes() instead of raw nodes for building columns",
        "Column headers update counts to reflect filtered results",
        "Empty columns still show (with 0 count) so the board structure is stable",
        "If all nodes filtered out, show a 'No matching nodes' message",
      ],
    },
    {
      key: "T5",
      title: "Integrate filters with 3D Solar System view",
      description: "In the 3D view, filtered-out nodes should be dimmed (low opacity) rather than hidden, to preserve spatial context.",
      complexity: 2,
      status: "todo",
      files: ["src/components/canvas/SkillTreeCanvas.tsx", "src/components/canvas/SkillNode3D.tsx"],
      dependencies: ["T1"],
      acceptance_criteria: [
        "Nodes not matching filters render at ~15% opacity",
        "Matched nodes render at full brightness (per their status)",
        "Dimmed nodes are not clickable/hoverable",
        "When no filters active, all nodes render normally",
        "Smooth opacity transition (Three.js lerp)",
      ],
    },
    {
      key: "T6",
      title: "Integrate filters with Gantt/Timeline view",
      description: "Gantt view should hide filtered-out nodes from the timeline.",
      complexity: 2,
      status: "todo",
      files: ["src/components/canvas/GanttView.tsx"],
      dependencies: ["T1"],
      acceptance_criteria: [
        "Uses getFilteredNodes() for rendering bars",
        "Swimlane headers still show type groups but only include matching nodes",
        "Empty swimlanes hidden",
        "'No matching nodes' message when everything filtered",
      ],
    },
    {
      key: "T7",
      title: "Filter count badge & active filter indicator",
      description: "Show a badge on the filter bar indicating how many nodes match out of total (e.g., '12 / 45 nodes'). Also show a visual indicator on ViewSwitcher when filters are active.",
      complexity: 1,
      status: "todo",
      files: ["src/components/canvas/FilterBar.tsx", "src/components/canvas/ViewSwitcher.tsx"],
      dependencies: ["T2"],
      acceptance_criteria: [
        "FilterBar shows 'X of Y nodes' count",
        "When filters are active, a small dot/indicator appears near ViewSwitcher",
        "Count updates reactively as filters change",
      ],
    },
  ];

  const { data, error } = await supabase
    .from("tickets")
    .upsert(tickets, { onConflict: "key" })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message, createError: createError?.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tickets: data });
}
