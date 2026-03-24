# TICKET-024: Edge CRUD in tree store

**Status:** done
**Roadmap item:** ITEM-025
**Created:** 2026-03-24T15:30:05Z
**Completed:** 2026-03-24
**Commit:** 05411f9

## Brief
add/remove/update edges via Zustand + Supabase

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/types/skill-tree.ts`**
- Added `EdgeType` union type (`"parent" | "depends_on" | "blocks" | "related" | "references"`)
- Extended `SkillEdge` interface with `type: EdgeType` and `weight: number` fields (matching migration 004)

**`src/lib/store/tree-store.ts`**
- Imported `SkillEdge`, `EdgeType` from types and `createClient` from Supabase
- Added `NewEdgeInput` interface (input shape for `addEdge`, tree_id inferred from store)
- Added `edges: SkillEdge[]` state (default `[]`)
- Added `setEdges(edges)` setter
- Added `addEdge(input)` — optimistic insert with rollback on Supabase error
- Added `removeEdge(edgeId)` — optimistic delete with rollback on error
- Added `updateEdge(edgeId, data)` — optimistic patch with rollback on error

**`src/app/(app)/tree/[id]/page.tsx`**
- Imported `SkillEdge` type
- Destructured `setEdges` from `useTreeStore`
- Added `skill_edges` fetch to the `loadTree` parallel query (`Promise.all`)
- Calls `setEdges()` after load to hydrate edge state

## Summary

Added full edge CRUD to the Zustand tree store with Supabase persistence. The `SkillEdge` type was extended to reflect the `type` and `weight` columns added in migration 004. Three async actions were added to the store — `addEdge`, `removeEdge`, `updateEdge` — each using an optimistic update pattern (apply locally first, roll back on Supabase error). A `setEdges` setter and `edges` state field were also added. The tree page now fetches edges alongside nodes on load, so edge state is fully hydrated on entry. No changes to rendering or AI tooling — edges are available for future views without touching existing orbital rendering.
