# TICKET-038: Hover path highlight

**Status:** done
**Roadmap item:** ITEM-059
**Created:** 2026-03-25T02:30:13Z
**Completed:** 2026-03-25
**Commit:** 01b07b5

## Brief
on hover, highlight the full unlock chain (ancestors + descendants) so user can trace what unlocks what

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

**`src/components/canvas/SkillTreeView2D.tsx`** — sole file changed (+88/-9):
- Added `hoveredNodeId` state (local, separate from store's hoveredNodeId)
- Added `hoveredChain` useMemo: BFS traversal up (ancestors via `source_id`) and down (descendants via `target_id`) the `depends_on` edge graph, returns a Set of all node IDs in the unlock chain
- Added `chainEdgeIds` useMemo: Set of edge IDs where both endpoints are in the chain
- Node `onMouseEnter`/`onMouseLeave` handlers to set/clear `hoveredNodeId`
- Node rendering: chain nodes get indigo border/glow, hovered node gets brighter accent, non-chain nodes dim to 25% opacity; smooth CSS transitions
- Edge rendering: chain edges rendered in indigo with a matching arrowhead marker, non-chain edges dim to 15% opacity on hover; added `arrowhead-chain` SVG defs marker

## Summary

Implemented hover path highlighting in the 2D skill tree view. When a user hovers over any node, the full unlock chain (all ancestors it depends on, plus all descendants that depend on it) is highlighted in indigo — nodes glow and edges turn purple — while everything outside the chain fades to near-invisible. Uses BFS traversal on the `depends_on` edge graph in both directions. No store changes required; hover state is local to the component for performance and to avoid coupling with the 3D solar view.
