# TICKET-037: Node glow by status

**Status:** done
**Roadmap item:** ITEM-058
**Created:** 2026-03-25T02:00:27Z
**Completed:** 2026-03-25
**Commit:** 6704646

## Brief
locked=dark/muted, in_progress=amber pulse, completed=green glow; matches game skill tree aesthetic

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/app/globals.css`** (+24 lines)
- Added `@keyframes node-glow-pulse` — amber pulse animation for in_progress nodes
- Added `@keyframes node-glow-green` — subtle steady green glow for completed nodes
- Added utility classes: `.node-status-locked`, `.node-status-in_progress`, `.node-status-completed`

**`src/components/canvas/SkillTreeView2D.tsx`** (+14 lines, -5 lines)
- Updated `STATUS_COLORS` — locked dot is now dark slate (#334155), completed is green (#34d399) matching glow colour
- Node div now receives a `className` (e.g. `node-status-in_progress`) that drives the CSS glow animation
- Locked nodes get darkened background (`rgba(10,14,26,0.75)`) and 55% opacity for a muted appearance
- Pin/highlight states bypass the glow class so they don't interfere with existing selection visuals

## Summary

Added status-driven glow effects to the 2D skill tree view to match the game skill tree aesthetic:

- **locked** — dark/muted: darker background, reduced opacity (55%), muted slate status dot. No glow.
- **in_progress** — amber pulse: CSS keyframe animation pulses an amber box-shadow in and out (~1.8s cycle), matching the amber colour already used in the 3D view's `useFrame` glow.
- **completed** — green glow: gentle steady green box-shadow with a slow breathing animation (~2.4s cycle), using the same green (#34d399) as the planet/satellite type border colour.

The 3D view (`SkillNode3D.tsx`) already had equivalent glow logic in its `useFrame` animation loop — this ticket brings the 2D flat view up to parity. Implementation is purely CSS + class names; no JS animation loops required for the 2D view.
