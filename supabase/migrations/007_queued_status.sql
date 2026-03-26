-- Migration 007: Add 'queued' status to skill_nodes
-- queued = user has staged this ticket for the next agent run
-- Flow: locked → queued (user drags) → in_progress (agent picks up) → completed

-- Drop old check constraint and add new one including 'queued'
ALTER TABLE skill_nodes
  DROP CONSTRAINT IF EXISTS skill_nodes_status_check;

ALTER TABLE skill_nodes
  ADD CONSTRAINT skill_nodes_status_check
  CHECK (status IN ('locked', 'queued', 'in_progress', 'completed'));
