# TICKET-023: Add type column to nodes

**Status:** done
**Roadmap item:** ITEM-023
**Created:** 2026-03-24T15:03:48Z
**Completed:** 2026-03-24
**Commit:** 35a134d1e2c607eb06b004ca107d557fa78b85de

## Brief
migrate role → type, keep backward compat

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/types/skill-tree.ts` — Added `NodeType` type alias and `type` field to `SkillNode` interface; `role` kept for backward compat
- `src/lib/store/tree-store.ts` — `layoutGalaxy` now uses `type ?? role` via `nodeType()` helper; `updateNode` triggers relayout on `type` changes
- `src/lib/ai/prompt.ts` — Node filtering uses `type ?? role` fallback
- `src/lib/ai/parse.ts` — `describeChange` uses `type ?? role` for display tag
- `src/components/chat/PendingChange.tsx` — `add_node` and `update_node` handlers write both `type` and `role` columns
- `src/components/chat/ChatPanel.tsx` — Same dual-write in `acceptAll()`
- `src/app/(app)/dashboard/page.tsx` — Selects `type` column; uses `type ?? role` for stats and thumbnail filtering
- `src/app/api/share/[id]/route.ts` — Added `type` to the node select list
- `src/components/canvas/SkillNode3D.tsx` — `pickPlanetForRole` and `labelSize` use `type ?? role`
- `src/components/canvas/SkillTreeCanvas.tsx` — `ZOOM_DISTANCE` lookup and `parentRole` prop use `type ?? role`
- `src/components/canvas/ReadOnlyCanvas.tsx` — `parentRole` prop uses `type ?? role`
- `src/components/canvas/SearchPanel.tsx` — Node grouping and role icon/color lookup use `type ?? role`
- `src/components/panel/NodeDetailPanel.tsx` — `PanelHeader` role prop uses `type ?? role`
- `src/components/ui/TreeThumbnail.tsx` — `ThumbnailNode` interface adds optional `type`; filtering uses `type ?? role`
- `supabase/migrations/004_graph_foundation.sql` — DB migration (already existed): adds `type` column, backfills from `role`

## Summary
Migration 004 had already added the `type` column to `skill_nodes` and backfilled it from `role`. This ticket wires up the frontend to prefer `type` everywhere while falling back to `role` for any legacy rows where `type` might be null.

Key decisions:
- **Dual-write**: when creating or updating nodes, both `type` and `role` are written with the same value so the DB stays consistent regardless of which column other queries read.
- **`type ?? role` pattern**: all read paths use this fallback so nothing breaks if `type` is ever null on an older row.
- **`NodeType` = `NodeRole`**: the new type alias starts as identical to `NodeRole` but leaves the door open to expand the union later (e.g. add "concept", "milestone").
- **TypeScript clean**: `npx tsc --noEmit` passes with zero errors after all changes.
