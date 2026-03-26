-- Migration 008: Add completed_at to skill_nodes
-- Tracks when a node's status transitions to 'completed'.
-- Used by Gantt view to render ticket duration bars (created_at → completed_at).
--
-- IMPORTANT: Apply via Supabase Dashboard SQL Editor or psql:
--   psql $DATABASE_URL -f supabase/migrations/008_node_completed_at.sql

ALTER TABLE skill_nodes
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill: for nodes already in 'completed' status, set completed_at = created_at
-- (best approximation since we don't have the real timestamp)
UPDATE skill_nodes
  SET completed_at = created_at
  WHERE status = 'completed' AND completed_at IS NULL;

-- Index for Gantt queries that filter/sort by completed_at
CREATE INDEX IF NOT EXISTS skill_nodes_completed_at_idx
  ON skill_nodes (tree_id, completed_at)
  WHERE completed_at IS NOT NULL;
