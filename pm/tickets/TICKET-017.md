# TICKET-017: Share tree (read-only link)

**Status:** done
**Roadmap item:** ITEM-017
**Created:** 2026-03-24T07:20:02Z
**Completed:** 2026-03-24T07:30:00Z

## Brief
only link) — generate a public share URL that renders the tree in read-only mode

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/app/api/share/[id]/route.ts` — New public API endpoint using service role key (bypasses RLS) to serve tree + nodes as JSON
- `src/app/share/[id]/page.tsx` — New public share page with read-only 3D galaxy canvas, no auth required
- `src/components/canvas/ReadOnlyCanvas.tsx` — New read-only canvas component (no status cycling, no chat panel)
- `src/components/canvas/SkillNode3D.tsx` — Added `readOnly` prop; skips status cycling on click/space when true
- `src/components/panel/NodeDetailPanel.tsx` — Added `readOnly` prop; shows checklist as static view (no add/toggle/AI)
- `src/app/(app)/tree/[id]/page.tsx` — Added 🔗 Share button that copies `/share/<id>` URL to clipboard

## Summary
Added public share links for skill trees. Clicking "🔗 Share" in the tree header copies a `/share/<id>` URL to the clipboard. Anyone with the link can view the full 3D galaxy in read-only mode — no login required, no editing possible. The share API uses the Supabase service role key to bypass RLS, exposing only safe read-only fields.

## Commit
6eaba226ded1941885469d4aea97b06219b0d7f8
