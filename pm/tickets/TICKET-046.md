# TICKET-046: Board view (Kanban)

**Status:** done
**Roadmap item:** ITEM-049
**Created:** 2026-03-25T06:30:13Z
**Completed:** 2026-03-25
**Commit:** 53b5525

## Brief
Backlog / Active / Done columns with drag-to-reprioritise

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/canvas/KanbanView.tsx` — **new file**: full Kanban board component with Backlog/Active/Done columns, native HTML5 drag-and-drop, drop indicator lines, click-to-pin detail panel, search highlight support, and Supabase persistence for status + priority changes
- `src/lib/store/tree-store.ts` — added `"kanban"` to the `ViewMode` union type
- `src/app/(app)/tree/[id]/page.tsx` — imported `KanbanView`, added "📋 Board" button to the view mode switcher, and wired the kanban render branch

## Summary

Built a Kanban board view as the sixth view mode in SkillForge. The board shows three columns — Backlog (locked nodes), Active (in_progress), and Done (completed) — each sorted by priority descending. Cards support native HTML5 drag-and-drop: dragging a card between columns updates its status, and dragging within a column reorders by recalculating priority as a midpoint between neighbours. Drop indicator lines show exactly where the card will land. Priority and status changes are persisted optimistically to Supabase via the existing `updateNode` store method plus a direct supabase update call. Cards show node label, type (colour-coded), priority value, icon, and description snippet. Clicking a card pins the NodeDetailPanel. The view is consistent with the existing dark glass aesthetic used across Gantt, Weight, and Memory views.
