-- Migration 004: Graph Foundation
-- Adds node type, properties, and edge type/weight for multi-view support.
-- Non-destructive — existing columns are kept, new ones added alongside.

-- ── skill_nodes ──────────────────────────────────────────────────────────────

-- Add flexible node type (user-defined, e.g. "skill", "task", "concept", "milestone")
-- Seeded from existing role column so no data is lost
alter table skill_nodes
  add column if not exists type text;

-- Backfill type from role for existing rows
update skill_nodes set type = role where type is null;

-- Set default going forward (falls back to 'skill' for new nodes)
alter table skill_nodes
  alter column type set default 'skill';

-- Add properties jsonb for structured metadata (due_date, assignee, estimate, difficulty, etc.)
alter table skill_nodes
  add column if not exists properties jsonb not null default '{}'::jsonb;

-- ── skill_edges ───────────────────────────────────────────────────────────────

-- Add edge type: defines the relationship semantics
-- parent       → hierarchy (replaces role-based parent_id)
-- depends_on   → A must be done before B (Gantt / skill prereqs)
-- blocks       → A is blocking B
-- related      → soft association (memory map)
-- references   → A cites / links to B (knowledge graph)
alter table skill_edges
  add column if not exists type text not null default 'parent'
    check (type in ('parent', 'depends_on', 'blocks', 'related', 'references'));

-- Add weight for force-directed layout (higher = stronger pull between nodes)
alter table skill_edges
  add column if not exists weight float not null default 1.0;

-- ── indexes ───────────────────────────────────────────────────────────────────

-- Speed up edge lookups by type (used heavily by view layout engines)
create index if not exists skill_edges_type_idx on skill_edges(tree_id, type);

-- Speed up node lookups by type
create index if not exists skill_nodes_type_idx on skill_nodes(tree_id, type);

-- ── backfill parent edges from parent_id ─────────────────────────────────────
-- Existing hierarchy is encoded in parent_id on skill_nodes.
-- Create corresponding skill_edges rows of type 'parent' so the new
-- edge-based system works without losing existing tree structure.

insert into skill_edges (id, tree_id, source_id, target_id, label, type, weight)
select
  concat('edge-parent-', n.id) as id,
  n.tree_id,
  n.parent_id as source_id,
  n.id        as target_id,
  null        as label,
  'parent'    as type,
  1.0         as weight
from skill_nodes n
where n.parent_id is not null
  and not exists (
    select 1 from skill_edges e
    where e.tree_id  = n.tree_id
      and e.source_id = n.parent_id
      and e.target_id = n.id
      and e.type = 'parent'
  );
