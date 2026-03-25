# TICKET-040: Today marker

**Status:** done
**Roadmap item:** ITEM-039
**Created:** 2026-03-25T03:30:13Z
**Completed:** 2026-03-25
**Commit:** e02ab49

## Brief
vertical line at current date in Gantt view

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

**`src/components/canvas/GanttView.tsx`**
- Added `useEffect` import
- Added `useEffect` that runs on mount: computes a `scrollLeft` offset that centers today in the visible timeline area, so the amber today marker is immediately visible without needing to pan
- Strengthened the existing today vertical line: opacity raised from 0.4 → 0.75, width 1.5px → 2px, added `boxShadow` glow (`rgba(245,158,11,0.35)`)

## Summary

The Gantt view already had the amber "Today" vertical line and label from the TICKET-033 layout engine, but the view always opened at scroll position 0 (the epoch), so the marker was off-screen for any tree with near-term work. This ticket adds auto-scroll-to-today on mount: a `useEffect` calculates the scroll position needed to center today in the visible timeline, setting it once at load. The today line itself was also polished — higher opacity, slightly thicker, and a subtle amber glow — so it reads clearly against the Gantt bars.
