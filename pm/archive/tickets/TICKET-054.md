# TICKET-054: Skill tree view as world map

**Status:** done
**Roadmap item:** ITEM-052
**Created:** 2026-03-25T10:40:14Z
**Completed:** 2026-03-25
**Commit:** 00b1c88b90e694519348661eb0140d774c253ed7

## Brief
dependency graph top-down, locked nodes dark, active pulsing, completed glowing

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

- `src/components/canvas/WorldMapView.tsx` — new component (620 lines): RPG-style SVG world map with dagre top-to-bottom layout, terrain-coloured landmark circles, road/path connectors, fog-of-war texture for locked nodes, CSS-animated amber pulse for in_progress, CSS-animated green glow for completed, compass rose decoration, pan/zoom, pin detail panel, search integration
- `src/app/globals.css` — added `@keyframes wm-pulse`, `@keyframes wm-glow`, `.wm-pulse-ring` and `.wm-glow-ring` CSS animation classes
- `src/lib/store/tree-store.ts` — added `"worldmap"` to `ViewMode` union type
- `src/app/(app)/tree/[id]/page.tsx` — imported `WorldMapView`, added `🗺️ Map` button to view switcher, wired up render branch

## Summary

Built a new "World Map" view accessible via the 🗺️ Map button in the view switcher. The view uses the same dagre dependency graph layout as the 2D tree view (top-to-bottom flow) but renders nodes as RPG-style landmark circles rather than flat rectangles.

**Node visual states:**
- **Locked** — dark `#1a1a2e` fill with fog-of-war dot/hatch overlay patterns and a 🔒 icon; desaturated, clearly inaccessible
- **In Progress (active)** — warm amber fill with a CSS-animated pulsing ring (`wm-pulse-ring`) that expands and fades on a 1.8s loop; text in gold
- **Completed** — deep green fill with a steady CSS-animated glow halo (`wm-glow-ring`) on a 2.4s loop; text in mint green
- **Available** — muted navy fill with slate-blue border

**Connectors:** Road-style paths — a wide dark shadow lane under a thinner coloured surface lane. `depends_on` edges use teal-ish colour, `blocks` edges use dashed red. Both carry arrowheads.

**Decorations:** Subtle dot-grid background, outer decorative rings per node (solid for stellar, dashed for planet/satellite), compass rose in the bottom-right corner of the layout.

Decisions: re-used dagre layout logic from `SkillTreeView2D` rather than duplicating the force layout from `MemoryMapView` — top-down tree is the right shape for a "path through the world" metaphor. SVG-based to keep animation smooth without WebGL overhead.
