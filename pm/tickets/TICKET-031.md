# TICKET-031: View switcher UI

**Status:** done
**Roadmap item:** ITEM-034
**Created:** 2026-03-24T23:00:21Z
**Completed:** 2026-03-24
**Commit:** a5bf402

## Brief
toggle between Solar System and Skill Tree

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

- `src/lib/store/tree-store.ts` — added `ViewMode` type (`"solar" | "tree"`), `viewMode` state (persisted to localStorage), and `setViewMode` action
- `src/components/canvas/SkillTreeView2D.tsx` — new component: 2D hierarchical skill tree layout (top-down tree diagram) with pan/zoom, node detail panel integration, and search panel reuse
- `src/app/(app)/tree/[id]/page.tsx` — imported `SkillTreeView2D`, wired up `viewMode`/`setViewMode` from store, added Solar/Tree toggle button group in the header, swapped canvas render based on active view

## Summary

Added a view switcher that lets users toggle between the existing 3D Solar System canvas and a new flat 2D Skill Tree diagram.

The 2D view (`SkillTreeView2D`) computes a top-down hierarchical tree layout from the same node data used by the 3D view — stellars are roots, planets their children, satellites their grandchildren. Layout is computed with a bottom-up width-measure pass then a top-down position pass, with bezier curve edges drawn on an SVG layer. The view supports drag-to-pan and scroll-to-zoom, and reuses the existing `NodeDetailPanel` and `SearchPanel` components so all detail/search functionality carries over.

The toggle is a segmented button group ("🪐 Solar / 🌿 Tree") placed in the page header, consistent with the existing button style. Selection persists to `localStorage` so the user's preferred view survives page refreshes. No regressions to the 3D solar view.
