# TICKET-032: Date properties UI

**Status:** done
**Roadmap item:** ITEM-035
**Created:** 2026-03-24T23:30:04Z
**Completed:** 2026-03-24
**Commit:** 29a8415

## Brief
add due_date / start_date / estimate to NodeDetailPanel

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/panel/PanelDates.tsx` — new component displaying start_date, due_date, estimate from node properties; each field is click-to-edit (date picker for dates, text for estimate); read-only mode hides empty fields
- `src/components/panel/NodeDetailPanel.tsx` — imported PanelDates and useTreeStore; added handleDateChange that updates properties in local store + persists to Supabase; renders PanelDates between PanelStatus and PanelChecklist

## Summary

Added a `PanelDates` component that shows `start_date`, `due_date`, and `estimate` fields in the `NodeDetailPanel`. Fields are read from `node.data.properties` (the existing jsonb column in Supabase). In editable mode, clicking any field activates an inline input (date picker for dates, free text for estimate); changes are optimistically committed to the tree store and persisted to Supabase. In read-only mode, the section is hidden when no dates are set. No schema changes required — the `properties` column already exists.
