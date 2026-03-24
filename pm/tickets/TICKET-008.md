# TICKET-008: Persist chat messages to Supabase

**Status:** done
**Roadmap item:** ITEM-008
**Created:** 2026-03-24T03:30:02Z
**Completed:** 2026-03-24T03:45:00Z
**Commit:** 4432836ec6073863598ed73f3209dff90a097846

## Brief
currently chat history is in-memory only; save/load from chat_messages table

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/components/chat/ChatPanel.tsx`: Added `useEffect` on mount to fetch existing messages from `chat_messages` table (filtered by `tree_id`, ordered by `created_at`, limit 50) and populate the Zustand store via `setMessages`. The API route already saved messages to Supabase; this change adds the load side so history persists across page reloads.

## Summary
Added chat history loading on mount in ChatPanel — fetches up to 50 messages from Supabase `chat_messages` table and populates the store, completing the save/load cycle.
