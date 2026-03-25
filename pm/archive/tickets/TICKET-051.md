# TICKET-051: Error boundary for 3D canvas

**Status:** done
**Roadmap item:** ITEM-021
**Created:** 2026-03-25T09:00:30Z
**Completed:** 2026-03-25
**Commit:** 544f3ed

## Brief
wrap SkillTreeCanvas in an ErrorBoundary with a fallback UI

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/app/share/[id]/page.tsx` — imported `CanvasErrorBoundary` and wrapped `<ReadOnlyCanvas />` with it (the share/public-facing 3D canvas page was the only canvas not yet guarded by the boundary)

## Summary

`CanvasErrorBoundary` already existed as a class component in `src/components/ui/CanvasErrorBoundary.tsx` with a fallback UI (galaxy emoji, error message, retry button). It was already applied to `SkillTreeCanvas` in the authenticated tree page. The only gap was `ReadOnlyCanvas` on the public share page — that canvas had no error protection.

Added `CanvasErrorBoundary` import and wrapped `<ReadOnlyCanvas />` in `src/app/share/[id]/page.tsx`. Now both 3D canvas surfaces (authenticated and read-only share) are covered by the error boundary with a consistent fallback UI.
