# TICKET-013: Search result highlight

**Status:** done
**Roadmap item:** ITEM-013
**Created:** 2026-03-24T05:20:02Z
**Completed:** 2026-03-24T05:45:00Z

## Brief
when search finds a node, briefly highlight/pulse it in the canvas (currently just flies camera to it)

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Summary
Added a `searchHighlightId` field to the Zustand tree store. When the user selects a node from the search panel, `setSearchHighlight` is called alongside `setFocusTarget`. This sets a node ID that auto-clears after 2.5s via `setTimeout`. In `SkillNode3D`, a pulse ring mesh is rendered and animated in `useFrame`: it expands from 1× to 3× the node's scale while fading from 70% opacity to 0 over 2.5 seconds, giving a clear ripple-out visual cue after the camera flies to the node.

## Git Diff Summary
- `src/lib/store/tree-store.ts`: Added `searchHighlightId` state + `setSearchHighlight` action with auto-clear timeout
- `src/components/canvas/SearchPanel.tsx`: Call `setSearchHighlight(node.id)` on search result selection
- `src/components/canvas/SkillNode3D.tsx`: Added `pulseRingRef` mesh + `useFrame` animation for expand/fade highlight effect

## Commit hash
727c49dba984d235b70c7006098e3fe1654bfdcb
