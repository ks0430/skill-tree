# TICKET-048: Empty state for dashboard

**Status:** done
**Roadmap item:** ITEM-002
**Created:** 2026-03-25T07:30:13Z
**Completed:** 2026-03-25
**Commit:** bd330a6

## Brief
show a prompt/CTA when user has no trees yet

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/app/(app)/dashboard/page.tsx` — enhanced the empty state (already present from TICKET-002) with example galaxy name chips ("Web Development", "Machine Learning", "System Design", "DevOps") that populate the input on click, giving new users instant inspiration

## Summary
The empty state UI (galaxy emoji, heading, description copy, inline create CTA) was already in place from TICKET-002. This ticket polished it by adding clickable example name chips below the create button. Clicking a chip prefills the input with a suggested galaxy name, reducing friction for first-time users who don't know what to call their first tree. Chips are styled as small rounded pills consistent with the existing glass/navy palette.
