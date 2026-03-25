# TICKET-041: Force

**Status:** done
**Roadmap item:** ITEM-041
**Created:** 2026-03-25T04:00:29Z
**Completed:** 2026-03-25
**Commit:** 694a98e

## Brief
directed layout engine (spring physics, repulsion)

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**New files:**
- `src/lib/force/layout.ts` — Core force-directed layout engine: Coulomb repulsion between all node pairs, Hooke spring attraction along edges (weighted by `edge.weight`), velocity damping, LCG-seeded deterministic initial placement on a circle, convergence detection, and canvas-centring pass. Exports `computeForceLayout` (batch) and `stepForce` (single tick for animation).
- `src/components/canvas/WeightGraphView.tsx` — SVG-based force graph canvas: runs batch layout then continues settling via `requestAnimationFrame`; node radius scales with degree; edge stroke width scales with weight; hover chain highlighting (direct neighbours); pan/zoom; click-to-pin detail panel; search highlight support.

**Modified files:**
- `src/lib/store/tree-store.ts` — Extended `ViewMode` union to include `"weight"`.
- `src/app/(app)/tree/[id]/page.tsx` — Imported `WeightGraphView`; added 🕸️ Graph button to the view-mode switcher; wired `viewMode === "weight"` branch to render `<WeightGraphView />`.

## Summary

Built a self-contained force-directed layout engine (`src/lib/force/layout.ts`) using spring physics: every node pair repels via an inverse-square Coulomb force, and every edge acts as a Hooke spring with stiffness proportional to `edge.weight`. The engine is split into `computeForceLayout` (runs to near-convergence, used for initial placement) and `stepForce` (single tick, used for animated settling in the component). Nodes are seeded on a circle with a deterministic LCG jitter to avoid symmetric deadlocks.

`WeightGraphView.tsx` renders the graph as an SVG: node size grows with connection degree (capped at 44 px radius), edge stroke width encodes weight (1–6 px), and hover illuminates a node's immediate neighbours. The component kicks off the batch layout on mount and then continues ticking with `requestAnimationFrame` until velocities decay below 0.15 px/tick, giving a smooth settling animation. Shares pan/zoom, pinned-panel, and search-highlight infrastructure with the existing 2D views.

View mode was extended from a 3-way to 4-way union (`solar | tree | gantt | weight`) with a 🕸️ Graph button added to the existing view switcher in the tree page.
