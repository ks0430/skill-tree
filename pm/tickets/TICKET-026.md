# TICKET-026: Wire edges to AI tools

**Status:** done
**Roadmap item:** ITEM-027
**Created:** 2026-03-24T20:30:56Z
**Completed:** 2026-03-24
**Commit:** 7beb792

## Brief
Claude can create depends_on / related edges

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/lib/ai/tools.ts`** — Added `add_edge` and `remove_edge` tools to `skillTreeTools`. `add_edge` supports `depends_on` and `related` types with optional label and weight. `remove_edge` takes an edge ID.

**`src/lib/ai/prompt.ts`** — Added rules 15–20 explaining when/how to use edge tools (depends_on for prerequisites, related for loose connections, descriptive ID slugs, don't over-create).

**`src/types/chat.ts`** — Extended `PendingChangeAction` union with `"add_edge"` and `"remove_edge"`.

**`src/lib/ai/parse.ts`** — Added `describeChange` cases for `add_edge` (shows direction arrow) and `remove_edge`.

**`src/components/chat/PendingChange.tsx`** — Wired `add_edge` and `remove_edge` cases into the individual accept handler; added cyan colour for `add_edge` in the action colour map.

**`src/components/chat/ChatPanel.tsx`** — Wired `add_edge` and `remove_edge` cases into the bulk `acceptAll` handler.

## Summary

Added two new AI tools (`add_edge` / `remove_edge`) so Claude can create and remove explicit relationship edges between skill nodes. The tools expose only the two most useful edge types: `depends_on` (prerequisite ordering) and `related` (loose thematic connection). These flow through the existing pending-change review pipeline — Claude proposes an edge, the user sees it as a cyan-highlighted pending change with an Accept/Reject button, and on accept it's persisted to Supabase via the existing `tree-store.addEdge` / `removeEdge` methods. The system prompt was updated with clear rules on when to use each type and how to form edge IDs. TypeScript compiles cleanly with no regressions.
