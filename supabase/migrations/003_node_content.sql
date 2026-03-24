-- Add structured content blocks to skill nodes (checklists, future rich text)
ALTER TABLE skill_nodes
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{"blocks":[]}'::jsonb;
