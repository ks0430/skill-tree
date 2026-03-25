# TICKET-014: Pinned node panel persists on refresh

**Status:** done
**Roadmap item:** ITEM-014
**Created:** 2026-03-24T05:40:03Z
**Completed:** 2026-03-24

## Brief
restore pinnedNodeId from localStorage on load

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Summary
Modified `setPinnedNode` in `tree-store.ts` to write/remove `pinnedNodeId` in localStorage on every change, and initialized the store's `pinnedNodeId` field by reading from localStorage at startup (SSR-safe via `typeof window !== "undefined"` guard).

## Git Diff Summary
- `src/lib/store/tree-store.ts`: initialize `pinnedNodeId` from `localStorage.getItem("pinnedNodeId")`; update `setPinnedNode` to persist to / remove from localStorage on each call.

## Commit
dda669dff9426e5145b92ac9d963a31404bdeb37
