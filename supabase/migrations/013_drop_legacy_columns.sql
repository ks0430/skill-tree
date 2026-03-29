-- Drop legacy columns from skill_nodes.
-- All data is now read/written exclusively through the `properties` JSONB column.
-- Migration 012 already backfilled properties from these columns.

ALTER TABLE skill_nodes
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS position_x,
  DROP COLUMN IF EXISTS position_y,
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS metadata;
