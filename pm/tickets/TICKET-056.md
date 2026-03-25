# TICKET-056: Orthographic top

**Status:** done
**Roadmap item:** ITEM-029
**Created:** 2026-03-25T11:00:11Z
**Completed:** 2026-03-25
**Commit:** 6a6a725

## Brief
down camera preset with pan/zoom controls

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/canvas/SkillTreeCanvas.tsx` — Added `OrthoZoomSync` component that syncs frustum from store; updated `Scene` to mount `OrthographicCamera` (makeDefault) + `OrthoZoomSync` when `topDownMode` is active; updated `CameraController` to disable native zoom (`enableZoom=false`) in top-down mode (zoom now via buttons); added `+`/`−` zoom button pair in the canvas overlay, visible only in top-down mode.
- `src/lib/store/tree-store.ts` — Added `orthoZoom: number` state (default 40, clamped 5–200) and `setOrthoZoom` action.

## Summary

Upgraded the existing top-down camera preset from a perspective camera locked overhead to a true orthographic projection. When the user presses `T` (or the ⊤ button), a `drei` `OrthographicCamera` replaces the default perspective camera and a `OrthoZoomSync` component keeps its frustum bounds in sync with an `orthoZoom` store value. Two overlay buttons (`+` / `−`) allow stepwise zoom in and out. Pan still works via mouse drag (OrbitControls, rotation locked). Exiting top-down mode restores the original perspective camera automatically.
