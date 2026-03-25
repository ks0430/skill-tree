# TICKET-053: PM loop writes back to SkillForge

**Status:** done
**Roadmap item:** ITEM-051
**Created:** 2026-03-25T10:01:12Z
**Completed:** 2026-03-25
**Commit:** 062a7704b8adf0dcc1ed3584629a1732a718a4a3

## Brief
ticket start/done syncs node status in real time (extend current mirror to be bidirectional)

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
skills/product-manager/scripts/pm_cycle.py — sf_get_pending_items now queries status=locked, type=planet ordered by priority ASC. sf_export_changelog updated to order by priority. roadmap.md remains changelog-only.

## Summary
Changed sf_get_pending_items to query skill_nodes where status=locked and type=planet, ordered by priority ASC (from the SkillForge UI). Previously ordered by phase/id which ignored user-set priority. Also updated sf_export_changelog to order by priority for consistency. roadmap.md is written to as a changelog when items complete, no longer used as execution order source.
