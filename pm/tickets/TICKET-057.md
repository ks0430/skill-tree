# TICKET-057: Glow shader on node status

**Status:** done
**Roadmap item:** ITEM-031
**Created:** 2026-03-25T11:10:14Z
**Completed:** 2026-03-25
**Commit:**

## Brief
locked=dark, in_progress=amber pulse, completed=green glow

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

`src/components/canvas/SkillNode3D.tsx` — added `statusGlowRef` mesh (atmosphere sphere at 1.35× node scale, `BackSide`, `depthWrite=false`) and `useFrame` logic:
- `locked`: glow mesh hidden
- `in_progress`: amber `#ffaa22`, opacity pulses 0.12–0.34 via `abs(sin(t * 2.5))`
- `completed`: green `#00ff88`, opacity breathes 0.14–0.22 via `sin(t * 1.2)`

## Summary

Added a per-node status glow using the existing shared atmosphere sphere geometry. The glow mesh sits just outside the planet at 1.35× scale and is driven in `useFrame` each frame: locked nodes keep it invisible (dark/dormant feel), in-progress nodes get an amber pulse with a faster sin cycle, and completed nodes get a calm green steady glow. No new geometry or shader was needed — reused `sharedGeo.atmosphere` with a `meshBasicMaterial` color swap and opacity animation.
