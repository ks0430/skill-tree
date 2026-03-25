# TICKET-015: Duplicate tree

**Status:** done
**Roadmap item:** ITEM-015
**Created:** 2026-03-24T06:00:22Z
**Completed:** 2026-03-24

## Brief
add "duplicate" option on dashboard to clone a tree with all its nodes

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
Added `duplicateTree()` function and `duplicatingId` state to dashboard. The function creates a new `skill_trees` row named "Copy of {name}", fetches all nodes from the original tree, and inserts them with the new `tree_id`. Added a "Duplicate" button (with spinner while in-progress) next to the Delete button on each tree card, visible on hover.

## Summary
Adds a "Duplicate" button on the dashboard that clones a skill tree with all its nodes into a new galaxy named "Copy of {original name}".

## Commit
eb7fe14876d72a6a9808bc5913a58e9485e152f6
