# TICKET-001: Loading state for dashboard

**Status:** done
**Roadmap item:** ITEM-001
**Created:** 2026-03-24T00:46:34Z
**Completed:** 2026-03-24

## Brief
add skeleton loader while skill trees are fetching from Supabase

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary
- `src/app/(app)/dashboard/page.tsx` — replaced the plain "Loading..." text with 3 animated skeleton cards that mirror the real tree card layout (title bar, description line, stat pills, progress bar). Uses Tailwind's `animate-pulse` and the existing `glass` class for consistency with the dark/glass UI.

## Summary
Replaced the plain "Loading..." placeholder with a skeleton loader showing 3 pulsing glass-style cards. Each skeleton card matches the structure of a real tree card (name, description, stats row, progress bar), giving users a clear sense of the incoming layout while Supabase fetches data.
