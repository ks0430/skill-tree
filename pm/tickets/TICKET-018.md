# TICKET-018: Tree thumbnail on dashboard

**Status:** done
**Roadmap item:** ITEM-018
**Created:** 2026-03-24T07:40:05Z
**Completed:** 2026-03-24
**Commit:** 7314ec7

## Brief
generate/store a static thumbnail preview for each tree card

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/components/ui/TreeThumbnail.tsx`** (new file)
- Canvas-based thumbnail renderer using HTML5 Canvas API (no external deps)
- Draws a mini solar-system view: background stars, stellar nodes with glow effects, planet orbits with nodes colour-coded by status (completed=green, in_progress=amber, locked=blue)
- Deterministic layout via seeded PRNG so thumbnails are stable across renders
- HiDPI-aware (scales by `devicePixelRatio`)

**`src/app/(app)/dashboard/page.tsx`** (modified)
- Added `ThumbnailNode` interface and `thumbnailNodes` field on `TreeWithProgress`
- `loadTrees()` now fetches `role` and `parent_id` from `skill_nodes` and collects stellar/planet nodes into `thumbnailMap`
- Dashboard tree cards render `<TreeThumbnail>` (120×76px) as a left-aligned preview alongside the title/stats
- Loading skeleton includes matching placeholder for the thumbnail slot

## Summary

Implemented a fully client-side, canvas-rendered thumbnail preview for each skill tree card on the dashboard. Rather than storing a static image in Supabase (which would require a serverless screenshot service or bucket uploads), the thumbnail is generated on-the-fly using the node data already fetched for the dashboard. This keeps it zero-cost, instant, and always in sync with tree state.

The `TreeThumbnail` component renders a miniature solar-system view matching the main 3D canvas aesthetic: dark navy background with star particles, glowing stellar nodes, subtle orbit rings, and colour-coded planet dots. Layout uses a seeded PRNG keyed to the tree ID so positions are deterministic and don't shift on re-render.
