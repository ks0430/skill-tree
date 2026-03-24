# TICKET-019: Memoize SkillNode3D render

**Status:** done
**Roadmap item:** ITEM-019
**Created:** 2026-03-24T08:10:07Z
**Completed:** 2026-03-24
**Commit:** c58ce6c

## Brief
wrap in React.memo to prevent unnecessary re-renders when unrelated store state changes

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/components/canvas/SkillNode3D.tsx`**
- Replaced the broad `useTreeStore()` destructure (subscribing to all store state) with granular selectors for each value used: `toggleNodeStatus`, `setHoveredNode`, `setFocusTarget`, `setPinnedNode`, `pinnedNodeId`
- Each selector is now `useTreeStore((s) => s.xxx)`, consistent with the existing `searchHighlightId` selector already in the file
- The component was already wrapped in `React.memo` but the wide store subscription was defeating it

## Summary

The component was already exported as `memo(function SkillNode3D(...))` from a previous commit, but one `useTreeStore()` call was subscribing to the entire store object without a selector. This caused every SkillNode3D instance to re-render on any store state change (e.g., camera tracking, chat panel state, pending changes), defeating the memo entirely.

Fix: split the broad destructure into five individual selector calls. Now each node only re-renders when one of the five specific store slices it cares about actually changes. This is consistent with the `searchHighlightId` selector already in the file.
