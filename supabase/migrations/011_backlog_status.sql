-- Migration 011: Add 'backlog' status to skill_nodes
-- backlog = ticket created but not yet ready for agent pickup
-- Flow: backlog → queued (user promotes) → in_progress (agent picks up) → completed

-- Drop old check constraint and add new one including 'backlog'
ALTER TABLE skill_nodes
  DROP CONSTRAINT IF EXISTS skill_nodes_status_check;

ALTER TABLE skill_nodes
  ADD CONSTRAINT skill_nodes_status_check
  CHECK (status IN ('backlog', 'locked', 'queued', 'in_progress', 'completed'));
