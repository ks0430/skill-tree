# TICKET-016: Export tree as JSON

**Status:** done
**Roadmap item:** ITEM-016
**Created:** 2026-03-24T07:00:03Z
**Completed:** 2026-03-24T07:03:00Z
**Commit:** 99d8808

## Brief
download the full tree (nodes + metadata) as a JSON file

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
`src/app/(app)/tree/[id]/page.tsx`: Added `exportTree()` function that builds a JSON payload from store state (`id`, `name`, `exported_at`, `nodes[]`) and triggers a browser download via a blob URL. Added "Export JSON" button to the tree page header that calls it. No extra Supabase round-trip — uses nodes already in the Zustand store.

## Summary
Added a client-side JSON export to the tree page. Clicking "Export JSON" in the header downloads `<tree-name>.json` containing the tree ID, name, export timestamp, and the full nodes array. Uses the Zustand store's in-memory nodes (already loaded on mount), so no extra DB call needed. Filename is slugified from the tree name.
