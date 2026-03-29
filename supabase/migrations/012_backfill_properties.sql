-- Backfill properties from legacy columns for any rows missing them.
-- After this migration, all reads go through the `properties` JSONB column.
-- Legacy columns (status, priority, position_x, position_y, role, metadata)
-- are kept in the table but no longer written by the application — they can
-- be dropped in a future migration once stable.
--
-- Note: created_at and completed_at were never DB columns on the remote table;
-- they were already stored in properties by the application.

UPDATE skill_nodes
SET properties = COALESCE(properties, '{}'::jsonb)
  || CASE WHEN properties->>'status' IS NULL AND status IS NOT NULL
       THEN jsonb_build_object('status', status) ELSE '{}'::jsonb END
  || CASE WHEN properties->>'priority' IS NULL AND priority IS NOT NULL
       THEN jsonb_build_object('priority', priority) ELSE '{}'::jsonb END
WHERE
  properties->>'status' IS NULL
  OR properties->>'priority' IS NULL;

-- Add index on properties->>status for the JSONB filter queries
CREATE INDEX IF NOT EXISTS idx_skill_nodes_properties_status
  ON skill_nodes ((properties->>'status'));
