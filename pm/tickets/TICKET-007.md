# TICKET-007: acceptAll fix for update_node

**Status:** done
**Roadmap item:** ITEM-007
**Created:** 2026-03-24T03:00:03Z
**Completed:** 2026-03-24T03:05:00Z

## Brief
acceptAll in ChatPanel only handles add_node; wire up update_node and remove_node cases

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Summary
Added `removeNode` and `updateNode` from tree-store to the `acceptAll` function in `ChatPanel.tsx`. Previously, bulk accept only handled `add_node` with a TODO comment for the other cases. Now `remove_node` deletes the node and its children from both the store and Supabase, and `update_node` applies field updates to both the store and DB — matching the logic already present in `PendingChange.tsx` for individual accepts.

## Git Diff Summary
- `src/components/chat/ChatPanel.tsx`: destructured `removeNode` and `updateNode` from `useTreeStore`; replaced the `// TODO` comment with `else if` branches for `remove_node` and `update_node` actions (17 insertions, 2 deletions)

## Commit
6c91f4b699664629905e09536f68c2fd3a36f2d3
