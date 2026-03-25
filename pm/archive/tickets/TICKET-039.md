# TICKET-039: Dependency arrow renderer

**Status:** done
**Roadmap item:** ITEM-038
**Created:** 2026-03-25T03:00:24Z
**Completed:** 2026-03-25
**Commit:** 45b58a2

## Brief
depends_on / blocks edges as arrows

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

**`src/components/canvas/EdgeRenderer.tsx`** — Added `DIRECTIONAL_TYPES` set (`depends_on`, `blocks`). For each directional edge, a `THREE.ConeGeometry` arrowhead mesh is created alongside the line. Each frame the cone is positioned 85% along the edge and rotated via `quaternion.setFromUnitVectors` to point from source → target. Expanded `collectPrereqPath` to also traverse `blocks` edges forward (blocked descendants) and backward (things that block the hovered node).

**`src/components/canvas/SkillTreeView2D.tsx`** — Added `type` field to `PositionedEdge` interface. `buildDagreLayout` now includes `blocks` edges in the dagre graph (source → target direction, meaning blocker ranks above what it blocks) alongside `depends_on` edges; an `edgeTypeMap` carries type info through to rendered paths. Added two new SVG `<marker>` defs (`arrowhead-blocks`, `arrowhead-blocks-chain`) with red fill. Path rendering now selects stroke colour (violet for depends_on, red for blocks) and marker per type; blocks edges additionally render dashed (`strokeDasharray="6 3"`) to visually distinguish them. Hover chain logic extended to traverse `blocks` edges in both directions.

## Summary

Rendered `depends_on` and `blocks` edges as directional arrows in both the 3D solar canvas and the 2D dagre view.

**3D (EdgeRenderer):** Added `THREE.ConeGeometry` arrowhead meshes for directional edge types. Each cone is positioned near the target end (85% along the line) and oriented each frame using `quaternion.setFromUnitVectors` to point source→target. Arrowheads inherit the same additive-blended colour and opacity as their line, so they participate in hover highlighting automatically. `blocks` path traversal was also added to `collectPrereqPath` so blocker chains highlight correctly on hover.

**2D (SkillTreeView2D):** `blocks` edges were previously silently ignored by dagre — they're now included with the correct layout direction (blocker ranks above blocked node). Each edge carries its `type` through `posEdges`. Rendering picks type-specific SVG arrowhead markers (violet for `depends_on`, red for `blocks`) and renders `blocks` edges with a dashed stroke to distinguish them visually from dependency edges. Hover chain highlighting was extended to cover both edge types.

**Design decisions:** Arrowheads point at the *target* end (conventional for dependency graphs). Dashed style for `blocks` keeps the distinction legible at a glance without adding a legend. Cone geometry is shared as a module-level constant to avoid per-edge GC pressure.
