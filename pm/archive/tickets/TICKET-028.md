# TICKET-028: Glow shader on node status

**Status:** done
**Roadmap item:** ITEM-031
**Created:** 2026-03-24T21:30:07Z
**Completed:** 2026-03-24
**Commit:** 7ce4297

## Brief
locked=dark, in_progress=amber pulse, completed=green glow

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/canvas/SkillNode3D.tsx` — added `statusGlowRef`, status glow animation in `useFrame`, and glow mesh in JSX

## Summary

Added a status-driven glow effect to 3D skill nodes in `SkillNode3D.tsx`. A new `statusGlowRef` mesh (using the existing `sharedGeo.atmosphere` geometry at 1.35x node scale, BackSide rendering) is animated each frame via `useFrame`:
- **locked**: glow hidden (no extra cost)
- **in_progress**: amber (#ffaa22) pulse — opacity oscillates between 0.12 and 0.34 using `Math.abs(Math.sin(t * 2.5))`
- **completed**: green (#00ff88) steady glow with subtle breathing (opacity ~0.18 ± 0.04)

Reused the existing atmosphere mesh pattern and `meshBasicMaterial` transparent approach already used for hover glow and search highlight, keeping code consistent. No new geometry or materials introduced beyond the one extra mesh per node.
