-- Migration 009: Flexible tree schema and view configs
-- Adds user-defined property schemas and view configurations per tree.
-- Non-destructive: existing columns (status, priority, role) remain untouched.

-- ── skill_trees: add schema + view_configs ──────────────────────────────────

ALTER TABLE skill_trees
  ADD COLUMN IF NOT EXISTS schema jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE skill_trees
  ADD COLUMN IF NOT EXISTS view_configs jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing trees with a default schema mirroring the legacy columns
UPDATE skill_trees SET schema = '{
  "properties": {
    "status": {
      "type": "select",
      "options": ["locked", "queued", "in_progress", "completed"]
    },
    "priority": {
      "type": "number"
    },
    "due_date": {
      "type": "date"
    },
    "assignee": {
      "type": "text"
    }
  }
}'::jsonb WHERE schema = '{}'::jsonb;

-- Backfill view configs
UPDATE skill_trees SET view_configs = '[
  { "id": "solar",  "name": "Solar System", "type": "solar_system" },
  { "id": "kanban", "name": "Board",        "type": "kanban", "group_by": "status" },
  { "id": "gantt",  "name": "Timeline",     "type": "gantt",  "date_field": "due_date" }
]'::jsonb WHERE view_configs = '[]'::jsonb;

-- ── skill_nodes: backfill properties from legacy columns ────────────────────

UPDATE skill_nodes
SET properties = properties
  || jsonb_build_object('status', status)
  || jsonb_build_object('priority', priority)
WHERE properties->>'status' IS NULL;
