# TICKET-021: Error boundary for 3D canvas

**Status:** done
**Roadmap item:** ITEM-021
**Created:** 2026-03-24T09:00:18Z
**Completed:** 2026-03-24
**Commit:** a1791ba

## Brief
wrap SkillTreeCanvas in an ErrorBoundary with a fallback UI

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/components/ui/CanvasErrorBoundary.tsx` — new class component implementing React error boundary; catches render errors from the 3D canvas, logs to console, and shows a fallback UI with a retry button
- `src/app/(app)/tree/[id]/page.tsx` — imported `CanvasErrorBoundary` and wrapped `<SkillTreeCanvas />` with it

## Summary
Created `CanvasErrorBoundary`, a React class component (required for `componentDidCatch` / `getDerivedStateFromError`), that wraps `SkillTreeCanvas` in the tree page. If the Three.js/R3F canvas throws during render, the user sees a themed fallback ("Galaxy failed to render" with the error message and a Retry button) instead of a blank screen or uncaught crash. The retry button resets component state to re-attempt rendering. Styling follows the existing `glass`, `font-mono`, and `border-glass-border` conventions.
