# TICKET-058: View switcher UI

**Status:** done
**Roadmap item:** ITEM-034
**Created:** 2026-03-25T11:20:11Z
**Completed:** 2026-03-25
**Commit:** 9b360c2

## Brief
toggle between Solar System and Skill Tree

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/canvas/ViewSwitcher.tsx` — new component: renders a segmented button group for all 7 view modes (`solar`, `tree`, `gantt`, `weight`, `memory`, `kanban`, `worldmap`); reads `viewMode` and calls `setViewMode` directly from `useTreeStore`; view options defined as a typed array so adding a new view is a one-line change
- `src/app/(app)/tree/[id]/page.tsx` — imported `ViewSwitcher`, replaced 65-line inline button group with `<ViewSwitcher />`, removed now-unused `setViewMode` from the destructured store bindings

## Summary

Extracted the inline view-mode button group from the tree page into a standalone `ViewSwitcher` component. The 7-view segmented toggle (🪐 Solar, 🌿 Tree, 📅 Gantt, 🕸️ Graph, 🧠 Memory, 📋 Board, 🗺️ Map) now lives in its own file, reads state directly from `useTreeStore`, and is referenced from the page with a single element. The view options array makes it easy to add future views without touching the render logic. Behaviour is identical to before — active view is highlighted in indigo, all transitions work, and TypeScript compiles clean with no regressions.
