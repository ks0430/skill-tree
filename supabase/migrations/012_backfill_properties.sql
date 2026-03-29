-- Backfill properties from legacy columns for any rows missing them.
-- After this migration, all reads go through the `properties` JSONB column.
-- Legacy columns (status, priority, position_x, position_y, role, metadata,
-- created_at, completed_at) are kept in the table but no longer written by
-- the application — they can be dropped in a future migration once stable.

UPDATE skill_nodes
SET properties = COALESCE(properties, '{}'::jsonb)
  || CASE WHEN properties->>'status' IS NULL AND status IS NOT NULL
       THEN jsonb_build_object('status', status) ELSE '{}'::jsonb END
  || CASE WHEN properties->>'priority' IS NULL AND priority IS NOT NULL
       THEN jsonb_build_object('priority', priority) ELSE '{}'::jsonb END
  || CASE WHEN properties->>'created_at' IS NULL AND created_at IS NOT NULL
       THEN jsonb_build_object('created_at', created_at) ELSE '{}'::jsonb END
  || CASE WHEN properties->>'completed_at' IS NULL AND completed_at IS NOT NULL
       THEN jsonb_build_object('completed_at', completed_at) ELSE '{}'::jsonb END
WHERE
  properties->>'status' IS NULL
  OR properties->>'priority' IS NULL
  OR (created_at IS NOT NULL AND properties->>'created_at' IS NULL)
  OR (completed_at IS NOT NULL AND properties->>'completed_at' IS NULL);

-- Add index on properties->>status for the JSONB filter queries
CREATE INDEX IF NOT EXISTS idx_skill_nodes_properties_status
  ON skill_nodes ((properties->>'status'));
