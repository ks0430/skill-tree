# TICKET-012: Node progress indicator on planet

**Status:** done
**Roadmap item:** ITEM-012
**Created:** 2026-03-24T05:00:03Z
**Completed:** 2026-03-24

## Brief
show a small visual ring or glow on planets that reflects their checklist completion %

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/components/canvas/SkillNode3D.tsx`: Added checklist progress computation from `node.data.content.blocks`, dynamic `RingGeometry` arc sized to completion %, and Billboard-rendered progress ring (faint background track + colored arc) on all planets with checklist data.

## Commit
e75414d37ed1bef9795bf13c8b938ccde15a51b8

## Summary
Added a billboard progress ring around planets that shows checklist completion as a colored arc (red → yellow → green), with a faint background track, only visible when a node has checklist items.
