# TICKET-030: Unlock animation

**Status:** done
**Roadmap item:** ITEM-033
**Created:** 2026-03-24T22:30:05Z
**Completed:** 2026-03-24
**Commit:** ab067b4

## Brief
locked to in_progress transition with particle burst

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/canvas/SkillNode3D.tsx` — added `UnlockParticles` component (48-particle burst using R3F `<points>`) and wired it into `SkillNode3D` via `unlockBurst` state + `prevStatusRef` to detect `locked → in_progress` transition

## Summary

Added an unlock animation that fires a particle burst whenever a skill node transitions from `locked` to `in_progress` status. The `UnlockParticles` component creates 48 points with randomised directions on a unit sphere, animates them outward over 1.4 seconds (scaled to node size), and fades their opacity to zero before cleaning up. A `prevStatusRef` in `SkillNode3D` tracks the previous status so the burst fires exactly once per unlock event. The burst colour is warm amber (`#ffcc44`) to complement the existing in_progress amber glow.
