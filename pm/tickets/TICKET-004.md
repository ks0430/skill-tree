# TICKET-004: Tree delete

**Status:** done
**Roadmap item:** ITEM-004
**Created:** 2026-03-24T01:30:02Z
**Completed:** 2026-03-24T01:33:50Z

## Brief
add delete button with confirmation dialog on dashboard

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Summary
Added a confirmation dialog modal to the dashboard delete flow. Clicking the Delete button now opens an animated modal (matching existing glass/Framer Motion style) asking the user to confirm before permanently deleting a galaxy and all its nodes.

## Git Diff Summary
- `src/app/(app)/dashboard/page.tsx`: Added `deleteConfirmId` state; delete button now sets confirm ID instead of calling `deleteTree` directly; added `AnimatePresence`-wrapped confirmation modal with cancel/delete actions.

## Commit
5f55949d074c1c74384ca5581875cb56e4926920
