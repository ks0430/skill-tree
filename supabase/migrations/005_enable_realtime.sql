-- Migration 005: Enable Supabase Realtime for skill_nodes
-- Required for Kanban board live updates when coding agents mark tickets as completed.
--
-- IMPORTANT: This migration must be applied via the Supabase Dashboard:
--   1. Go to https://supabase.com/dashboard/project/cnanilxkafouncbigbnn
--   2. Navigate to Database → SQL Editor
--   3. Paste and run this SQL
--
-- OR apply via psql:
--   psql $DATABASE_URL -f supabase/migrations/005_enable_realtime.sql

-- Enable REPLICA IDENTITY FULL so UPDATE/DELETE events include the full row
-- (without this, UPDATE events don't have payload.new populated correctly)
ALTER TABLE public.skill_nodes REPLICA IDENTITY FULL;

-- Add skill_nodes to the supabase_realtime publication
-- This is what actually makes Supabase Realtime deliver change events
ALTER PUBLICATION supabase_realtime ADD TABLE public.skill_nodes;

-- Verify (optional - just for inspection)
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
