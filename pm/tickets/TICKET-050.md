# TICKET-050: Memoize SkillNode3D render

**Status:** done
**Roadmap item:** ITEM-019
**Created:** 2026-03-25T08:30:15Z
**Completed:** 2026-03-25
**Commit:** 7f2fa84

## Brief
wrap in React.memo to prevent unnecessary re-renders when unrelated store state changes

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/components/canvas/SkillNode3D.tsx`**
- Replaced `const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId)` + derived `searchHighlightId === node.id` with two narrow boolean selectors:
  - `const isPinned = useTreeStore((s) => s.pinnedNodeId === node.id)`
  - `const isSearchHighlight = useTreeStore((s) => s.searchHighlightId === node.id)`
- Updated `onClick` handler and its dependency array to use `isPinned` instead of `pinnedNodeId`

## Summary

The component was already wrapped with `React.memo` (from TICKET-019), but two store subscriptions were still too broad: subscribing to the full `pinnedNodeId` string and `searchHighlightId` string caused every `SkillNode3D` instance to re-render whenever any node was pinned or a search result changed, because the selector returned a new value for all instances.

The fix narrows both selectors to return booleans (`isPinned`, `isSearchHighlight`) — each node now only re-renders when its own pin/highlight state changes, not when other nodes' states change. This makes `React.memo` effective for these two common interaction patterns.
