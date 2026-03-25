# TICKET-047: Flip PM source of truth

**Status:** done
**Roadmap item:** ITEM-050
**Created:** 2026-03-25T07:00:32Z
**Completed:** 2026-03-25
**Commit:** 82cef93

## Brief
pm_cycle.py reads ticket order from SkillForge DB instead of roadmap.md, auto-exports markdown as changelog

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
`skills/product-manager/scripts/pm_cycle.py`: Added `sf_get_pending_items()` (fetches locked planet nodes from DB ordered by phase+id), `sf_export_changelog()` (exports DB state to roadmap.md). In `main()`: replaced `get_pending_items(roadmap_path)` with DB-first call (falls back to roadmap.md if SF not configured or fetch fails). `mark_roadmap_done()` now only called when SF disabled. Changelog exported after each ticket completion and after advancing to next item.

## Summary
Flipped the PM loop so it reads pending work from the SkillForge Supabase DB (planet nodes with status=locked, ordered by phase then id) rather than parsing roadmap.md. roadmap.md is now auto-generated as a changelog mirror after each cycle tick when SkillForge is enabled. Falls back to the original roadmap.md parsing when SF is not configured, preserving backward compatibility. The DB is now the single source of truth for ticket ordering.
