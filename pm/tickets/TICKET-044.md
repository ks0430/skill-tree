# TICKET-044: Ambient camera drift

**Status:** done
**Roadmap item:** ITEM-046
**Created:** 2026-03-25T05:30:13Z
**Completed:** 2026-03-25
**Commit:** f6d42f4

## Brief
slow auto-rotation when idle

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

**`src/components/canvas/SkillTreeCanvas.tsx`** — sole file changed (+18 lines):
- Added `IDLE_TIMEOUT_MS = 5000` and `AMBIENT_ROTATE_SPEED = 0.3` constants
- Added `lastInteractionTime` ref to `CameraController`
- Added `useEffect` that listens for `mousedown`, `mousemove`, `wheel`, `touchstart`, `keydown` events and resets the idle timestamp on any interaction
- In `useFrame`, replaced the hardcoded `controls.autoRotate = false` in the non-tracking branch with idle detection: enables `autoRotate` after 5s of no input, sets `autoRotateSpeed` to 0.3

## Summary

Added ambient camera drift to the 3D skill tree canvas. When the user hasn't interacted (mouse, scroll, touch, keyboard) for 5 seconds and isn't in tracking or top-down mode, `OrbitControls.autoRotate` is enabled with a slow `autoRotateSpeed` of 0.3 — giving a gentle planetary drift effect. Any user interaction immediately resets the idle timer and stops the drift on the next frame. Top-down mode and node-tracking mode are unaffected, since they already control camera movement themselves.
