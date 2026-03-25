# TICKET-043: Memory map layout

**Status:** done
**Roadmap item:** ITEM-045
**Created:** 2026-03-25T05:00:23Z
**Completed:** 2026-03-25
**Commit:** f423d63

## Brief
tiered force with edge-type-weighted pull strengths

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/lib/force/layout.ts`**
- Added `edgeType?: EdgeType` field to `ForceEdge` interface
- Added `MEMORY_MAP_PULL_STRENGTH` constant: per-edge-type spring multipliers (`parent=2.0`, `depends_on=1.4`, `blocks=1.2`, `related=0.5`, `references=0.3`)
- Added `computeMemoryMapLayout()` function — runs the existing `stepForce` simulation but pre-scales each edge's weight by its type multiplier before the physics loop; uses tighter spring length (140px) and lower repulsion (6000) vs weight graph for more organic clustering

**`src/components/canvas/MemoryMapView.tsx`** *(new)*
- Full SVG canvas view, similar architecture to `WeightGraphView`
- Edge stroke colour, opacity, and width all encode edge type at a glance (indigo=parent, amber=depends_on, rose=blocks, emerald=related, slate=references)
- Per-type arrow markers in `<defs>`
- Legend in the bottom-left corner shows each edge type with its pull multiplier
- Animation loop uses the same type-scaled edges as the batch layout for consistent settlement

**`src/lib/store/tree-store.ts`**
- Extended `ViewMode` union: `"solar" | "tree" | "gantt" | "weight" | "memory"`

**`src/app/(app)/tree/[id]/page.tsx`**
- Added `MemoryMapView` import
- Added `🧠 Memory` button to the view switcher
- Wired `viewMode === "memory"` to render `<MemoryMapView />`

## Summary

Built the Memory Map view — a force-directed layout where edge type determines pull strength rather than a uniform spring constant. The core change is `computeMemoryMapLayout()` which pre-multiplies each edge's weight by `MEMORY_MAP_PULL_STRENGTH[edgeType]` before running the standard spring-physics simulation. This means `parent` edges (×2.0) cluster children tightly to their parent node, while `related` (×0.5) and `references` (×0.3) edges provide only a soft associative drift — giving the layout an Obsidian-graph-like feel where hierarchy and loose association coexist visually. The view is wired into the existing view switcher as a fifth mode (`🧠 Memory`).
