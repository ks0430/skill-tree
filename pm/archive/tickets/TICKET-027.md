# TICKET-027: Orthographic top

**Status:** done
**Roadmap item:** ITEM-029
**Created:** 2026-03-24T21:00:19Z
**Completed:** 2026-03-24
**Commit:** cf0a3d2

## Brief
down camera preset with pan/zoom controls

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/components/canvas/SkillTreeCanvas.tsx`**
- Added `topDownMode` and `setTopDownMode` from tree store into `CameraController` and `SkillTreeCanvas`
- Added `isTopDownFlying` ref to track top-down fly-to animation
- New `useEffect` in `CameraController`: when `topDownMode` activates, triggers a fly-to animation upward (Y=80) above the current target
- New block in `useFrame`: while `topDownMode` is active, locks camera directly above target (`enableRotate = false`), allows pan and zoom
- Added `T` keyboard shortcut in `SkillTreeCanvas` to toggle top-down mode (skips when input/textarea is focused)
- Added `⊤` button in bottom-right corner with active/inactive styling to toggle top-down mode
- Updated hint text to mention `T for top-down`

**`src/lib/store/tree-store.ts`**
- Added `topDownMode: boolean` state field (default `false`)
- Added `setTopDownMode: (enabled: boolean) => void` action

## Summary

Added an orthographic top-down camera preset to the 3D skill tree canvas.

When activated (via the `⊤` button in the bottom-right corner or the `T` keyboard shortcut), the camera smoothly flies to a bird's-eye position directly above the current view target, then locks into top-down mode. In this mode:
- Rotation is disabled (camera stays overhead)
- Pan is fully enabled so users can explore the skill tree by dragging
- Zoom (scroll wheel) continues to work normally
- The camera actively enforces overhead position each frame so it can't drift

The toggle button lights up indigo when active and reverts to the default slate style when off. Pressing `T` again or clicking the button returns to normal perspective mode with rotation restored.

State (`topDownMode`) lives in the Zustand tree store so it's accessible from anywhere. The implementation reuses the existing fly-to lerp animation system for a smooth transition.
