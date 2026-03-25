# TICKET-052: Today marker

**Status:** done
**Roadmap item:** ITEM-039
**Created:** 2026-03-25T09:30:13Z
**Completed:** 2026-03-25
**Commit:** 3c02f89

## Brief
vertical line at current date in Gantt view

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/components/canvas/GanttView.tsx`**
- Enhanced the today marker on the axis: replaced the plain "Today" text label with a styled amber pill chip showing the current date (e.g. "Mar 25")
- Pill chip uses high-contrast dark text on amber background, centered vertically in the axis strip
- The vertical line in the timeline area (amber glow line) was already present from TICKET-040 and remains unchanged

## Summary

The vertical today marker in the Gantt view was originally implemented in TICKET-040. This ticket (TICKET-052) enhanced the axis label from a plain text "Today" to a styled date chip (amber pill showing "MMM D" format). This makes the current date visually anchored and immediately readable without hovering. The chip is rendered inline using `toLocaleDateString` with `en-US` locale for consistent short-month format.
