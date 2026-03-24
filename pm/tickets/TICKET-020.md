# TICKET-020: Debounce Supabase writes in NodeDetailPanel

**Status:** done
**Roadmap item:** ITEM-020
**Created:** 2026-03-24T08:30:04Z
**Completed:** 2026-03-24
**Commit:** 6afe7be

## Brief
checklist toggle fires a DB write per click; debounce to 500ms

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/panel/NodeDetailPanel.tsx` — added `useRef` import; extracted `writeToDb` (raw Supabase call) from `persist`; rewrote `handleToggle` to update state immediately then schedule `writeToDb` via a 500ms debounce timer, cancelling any pending write on each new click.

## Summary

Checklist toggles previously called `persist` on every click, firing a Supabase write immediately each time. Rapid toggling could cause multiple in-flight writes with stale data arriving out of order.

The fix splits the concern: `writeToDb` handles only the DB write, while `persist` (used by add/remove/AI generate) still does both in sequence. `handleToggle` now updates local state immediately for snappy UI, then debounces the DB write to 500ms using a `useRef`-held timer. Each new toggle cancels the previous pending write, so only the final state within a burst is persisted. Zero regressions to add/remove/AI generate paths.
