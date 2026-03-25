# TICKET-034: Install dagre + rebuild SkillTreeView2D

**Status:** done
**Roadmap item:** ITEM-055
**Created:** 2026-03-25T00:30:17Z
**Completed:** 2026-03-25
**Commit:** fa39ecd

## Brief
replace column layout with dagre directed graph layout driven by depends_on edges; nodes positioned by dependency flow not phase grouping

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `package.json` / `package-lock.json` — added `dagre` + `@types/dagre` dependencies
- `src/components/canvas/SkillTreeView2D.tsx` — replaced custom parent_id tree layout with dagre directed graph layout; reads `depends_on` edges from store; falls back to parent_id hierarchy when no dependency edges exist; adds arrowhead markers on edges to show dependency direction

## Summary
Installed dagre (v0.8.5) and rewrote `SkillTreeView2D` to use a proper directed graph layout. The component now reads the `edges` array from the tree store and filters for `depends_on` type edges to build a dagre `TB` (top-to-bottom) directed graph — prerequisites appear above their dependents, showing the dependency flow rather than arbitrary phase grouping. When no dependency edges exist, it automatically falls back to using `parent_id` relationships so existing trees still render correctly. Edges are rendered as smooth polyline paths with SVG arrowhead markers. All pan/zoom interaction, node selection, search highlighting, and the detail panel are preserved unchanged.
