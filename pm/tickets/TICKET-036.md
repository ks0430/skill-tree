# TICKET-036: Visible edge lines

**Status:** done
**Roadmap item:** ITEM-057
**Created:** 2026-03-25T01:30:13Z
**Completed:** 2026-03-25
**Commit:** 7c92c3b

## Brief
render SVG lines between connected nodes in tree view, with arrowheads showing dependency direction

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/components/canvas/SkillTreeView2D.tsx`**
- Fixed `pointsToPath()`: replaced broken dead-code bezier logic with proper quadratic bezier curves (`Q` commands through midpoints), giving smooth curved edges between nodes
- Bumped edge stroke opacity from `0.3` → `0.7` so lines are clearly visible on the dark canvas
- Enlarged arrowhead marker (`8×6` → `10×7`) and brightened its fill from `rgba(148,163,184,0.4)` → `rgba(148,163,184,0.85)` so dependency direction is unambiguous

## Summary

The 2D tree view (SkillTreeView2D) already had the SVG edge infrastructure in place — dagre layout was computing waypoints and the SVG `<path>` elements existed — but edges were nearly invisible due to low opacity (0.3) and the bezier curve function had dead code that fell back to straight line segments instead of smooth curves.

Fixed by:
1. Rewriting `pointsToPath` to use quadratic bezier curves via midpoints (standard smooth polyline technique)
2. Raising stroke opacity to 0.7 for clear visibility on the dark `#0a0e1a` background
3. Making arrowheads larger and more opaque so dependency direction (prerequisite → dependent) is easy to read at a glance
