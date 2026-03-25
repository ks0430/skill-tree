# TICKET-059: Force-directed layout engine

**Status:** done
**Roadmap item:** ITEM-041
**Created:** 2026-03-25T11:30:11Z
**Completed:** 2026-03-25T11:50:00Z
**Commit:** 082b166

## Brief
Force-directed layout engine (spring physics, repulsion) for the Weight Graph view. Nodes repel each other (Coulomb inverse-square law), edges act as springs pulling connected nodes together (Hooke's law). Heavily connected nodes cluster naturally.

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/lib/force/layout.ts` — Enhanced `stepForce()` with: (1) center gravity force to prevent unbounded drift, (2) alpha cooling parameter so callers can decay simulation temperature each frame, (3) updated JSDoc
- `src/components/canvas/WeightGraphView.tsx` — Added alpha cooling schedule (0.995 decay per frame, stops at 0.001), `simRunning` state indicator, `restartSim` callback for user-triggered re-simulation, and restart button UI showing "⚡ settling…" / "↺ restart"
- `pm/roadmap.md` — Marked ITEM-041 as done

## Summary
Force-directed layout engine is fully implemented for the Weight Graph view: Coulomb repulsion keeps nodes apart, Hooke springs along edges cluster connected nodes, center gravity prevents drift, an alpha cooling schedule makes the simulation converge smoothly, and a restart button lets users re-run the physics from a fresh layout.
