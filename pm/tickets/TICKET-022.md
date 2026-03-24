# TICKET-022: Mobile layout

**Status:** done
**Roadmap item:** ITEM-022
**Created:** 2026-03-24T09:30:04Z
**Completed:** 2026-03-24
**Commit:** 5e3c7a7238f7c5752d92bbf39c805818e370e94d

## Brief
basic responsive layout for the tree page on narrow screens (collapse panels, show canvas full-width)

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

**`src/app/(app)/tree/[id]/page.tsx`** — main change:
- Added `isMobile` state + `useEffect` to detect `window.innerWidth < 768` and listen to resize events; auto-collapses chat on mobile mount
- On **desktop**: existing collapsed-tab + side-panel behaviour preserved unchanged
- On **mobile**: collapsed tab replaced with a floating FAB (chat bubble icon, bottom-right); chat panel rendered as a full-screen absolute overlay (`inset-0 z-30`) instead of a side panel
- Header: `treeName` gets `truncate max-w-[140px] sm:max-w-none` to avoid overflow on narrow screens; Export JSON button hidden on mobile (`hidden sm:inline-flex`)

## Summary

Added responsive behaviour to the tree page for narrow screens (< 768 px).

**What was built:**
- Mobile breakpoint detection via a `resize` listener in `useEffect`; collapses chat panel automatically on load if viewport is narrow
- On mobile, the desktop side-panel approach is replaced with a full-screen overlay: canvas remains full-width at all times; a floating action button (chat icon, bottom-right) opens the AI panel; `onCollapse` dismisses the overlay back to full canvas view
- Desktop layout is completely untouched — the existing collapsed-tab + `w-96` panel behaviour is still rendered for `!isMobile`
- Minor header polish: tree name truncation on mobile, Export JSON button hidden on `< sm`

**Decisions:**
- Full-screen overlay (not a bottom sheet) keeps the existing `ChatPanel` component reusable without any prop changes
- Used conditional rendering (`{isMobile && ...}`) rather than CSS-only show/hide to avoid mounting Two instances of `ChatPanel` simultaneously
- No new dependencies added
