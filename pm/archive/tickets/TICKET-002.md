# TICKET-002: Empty state for dashboard

**Status:** done
**Roadmap item:** ITEM-002
**Created:** 2026-03-24T01:15:24Z
**Completed:** 2026-03-24

## Brief
show a prompt/CTA when user has no trees yet

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
`src/app/(app)/dashboard/page.tsx` — replaced the minimal 2-line placeholder with a full-page empty state: galaxy 🌌 emoji, heading, descriptive copy, and an animated (Framer Motion fade-in) inline CTA duplicating the create-galaxy input+button so users can act without scrolling back up.

## Summary
Upgraded the dashboard empty state from a plain text stub to a centred, visually engaging CTA. When the user has no skill trees, they now see a large galaxy emoji, a welcoming headline, a short description, and a ready-to-use create form — all with a smooth fade-in animation consistent with the rest of the UI.
