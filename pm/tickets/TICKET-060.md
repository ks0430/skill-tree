# TICKET-060: [HIGH] KanbanView CSS border conflict

**Status:** done
**Roadmap item:** ITEM-061
**Created:** 2026-03-25T11:54:19Z
**Completed:** 2026-03-25T13:01:21Z
**Commit:** 713f31b79452b1a08916ca6c2662efb43b832f16

## Brief
replace shorthand border with separate borderTop/borderRight/borderBottom/borderLeft at lines 264 and 313 in KanbanView.tsx

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
Modified `src/components/canvas/KanbanView.tsx`:
- Replaced shorthand `border: \`1px solid ${...}\`` on phase filter button (line ~252) with four separate `borderTop`, `borderRight`, `borderBottom`, `borderLeft` properties
- Replaced shorthand `border: "1px solid rgba(148,163,184,0.15)"` on dropdown menu div (line ~270) with four separate border properties
- 1 file changed, 9 insertions(+), 2 deletions(-)

## Summary
Replaced two CSS shorthand `border` properties in KanbanView.tsx (phase filter button and dropdown menu) with explicit `borderTop`/`borderRight`/`borderBottom`/`borderLeft` properties to eliminate border conflicts with other styles.
