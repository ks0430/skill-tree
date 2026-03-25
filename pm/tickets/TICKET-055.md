# TICKET-055: Wire edges to AI tools

**Status:** done
**Roadmap item:** ITEM-027
**Created:** 2026-03-25T10:50:11Z
**Completed:** 2026-03-25
**Commit:** dc8e0e2

## Brief
Claude can create depends_on / related edges

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

### `src/lib/ai/prompt.ts`
- Updated `buildSystemPrompt` signature to accept an optional `edges: SkillEdge[]` parameter
- Added edge rendering block that lists all current edges (type, source → target, label, id) under "Explicit edges (depends_on / related)"

### `src/app/api/chat/route.ts`
- Extended the parallel data fetch to also query `skill_edges` for the current tree
- Passed the fetched edges to `buildSystemPrompt` so Claude sees them in its system context

## Summary

The `add_edge` and `remove_edge` tools were already defined in `tools.ts` and wired up in `PendingChange.tsx` and `ChatPanel.tsx` to apply/persist edge changes. What was missing was Claude having visibility into the existing edges when deciding whether to create new ones. This change loads the tree's edges in the chat route and injects them into the system prompt, giving Claude full context of existing `depends_on` and `related` connections before it responds. No new types or components were needed — just plumbing the data through the existing prompt builder.
