# TICKET-029: Edge renderer

**Status:** done
**Roadmap item:** ITEM-032
**Created:** 2026-03-24T22:00:16Z
**Completed:** 2026-03-24
**Commit:** f76cc08

## Brief
glowing lines between nodes, highlight prerequisite path on hover

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**New file:** `src/components/canvas/EdgeRenderer.tsx`
- `EdgeRenderer` component reads all edges from tree-store and renders each as a `THREE.Line` with additive blending for a glow effect
- `SingleEdgeLine` sub-component animates positions each frame by reading `worldPositions` (the live animated world-space map updated by `SkillNode3D`)
- On hover: edges connected to the hovered node (directly or via the prerequisite/`depends_on` chain) brighten to ~0.9 opacity; all others fade to 0.08
- When nothing is hovered: all edges render at 0.35 opacity
- Colour-coded by edge type: violet (`depends_on`), red (`blocks`), blue (`related`), green (`references`), slate (`parent` — hidden, orbital rings already show hierarchy)
- Opacity transitions are smoothed each frame with a lerp factor

**Modified:** `src/components/canvas/SkillTreeCanvas.tsx`
- Imported `EdgeRenderer` and added `<EdgeRenderer />` inside `Scene` (before nodes so lines render behind planets)

**Modified:** `src/components/canvas/ReadOnlyCanvas.tsx`
- Same wiring as above for the read-only share view

## Summary

Built a new `EdgeRenderer` component that draws glowing lines between skill nodes using `THREE.Line` with `AdditiveBlending`. Lines track animated orbital positions in real-time each frame via the existing `worldPositions` map. On hover, the component walks the `depends_on` edge graph to collect the full prerequisite chain and highlights those edges while fading all others — giving a clear visual path showing what a node depends on. Parent-type edges are intentionally skipped since orbital rings already communicate the hierarchy. TypeScript was clean on first compile pass after switching from JSX `<line>` (which TS maps to SVG) to `<primitive object={lineObj} />`.
