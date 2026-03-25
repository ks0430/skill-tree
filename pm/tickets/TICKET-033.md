# TICKET-033: Gantt layout engine

**Status:** done
**Roadmap item:** ITEM-036
**Created:** 2026-03-24T23:53:57Z
**Completed:** 2026-03-25
**Commit:** 04190c00385633ac99ab22163cf817a80289eb35

## Brief
map nodes to time axis positions

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
+src/lib/gantt/layout.ts, +src/components/canvas/GanttView.tsx; updated ViewMode type

## Summary
Added Gantt layout engine (`src/lib/gantt/layout.ts`) that maps nodes to horizontal time-bar positions using `start_date`, `due_date`, and `estimate` from node properties. Created `GanttView.tsx` with scrollable timeline, month axis ticks, today marker, status-fill bars, and pinnable node detail panel. Added "📅 Gantt" view mode button to the tree page alongside Solar and Tree views.
