-- Migration 006: agent_events table
-- Stores progress updates and lifecycle events from coding agents.
-- Used by NodeDetailPanel to show ticket history timeline.
--
-- IMPORTANT: Apply via Supabase Dashboard SQL Editor or psql:
--   psql $DATABASE_URL -f supabase/migrations/006_agent_events.sql

CREATE TABLE IF NOT EXISTS public.agent_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id     uuid        NOT NULL REFERENCES public.skill_trees(id) ON DELETE CASCADE,
  node_id     text        NOT NULL,
  event_type  text        NOT NULL CHECK (event_type IN ('started', 'progress', 'completed', 'error', 'commit')),
  message     text,
  agent_id    text,
  metadata    jsonb       DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for the common query: fetch all events for a node
CREATE INDEX IF NOT EXISTS agent_events_node_idx ON public.agent_events (tree_id, node_id, created_at DESC);

-- RLS: users can only read events for trees they own
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tree agent events"
  ON public.agent_events FOR SELECT
  USING (
    tree_id IN (
      SELECT id FROM public.skill_trees WHERE user_id = auth.uid()
    )
  );

-- Service role can insert events (coding agents use service role key)
CREATE POLICY "Service role can insert agent events"
  ON public.agent_events FOR INSERT
  WITH CHECK (true);
