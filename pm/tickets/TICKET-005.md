# TICKET-005: Toast notifications

**Status:** done
**Roadmap item:** ITEM-005
**Created:** 2026-03-24T02:00:03Z
**Completed:** 2026-03-24T02:15:00Z

## Brief
add a lightweight toast system for success/error feedback (create, delete, save)

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Summary
Installed `sonner` and wired up toast notifications throughout the app: galaxy create/delete/rename on dashboard, and node add/remove/update/checklist accept in the chat panel. The `<Toaster>` is mounted in root layout with dark theme matching the app's glass aesthetic.

## Git Diff Summary
- `src/app/layout.tsx`: Added `<Toaster>` with dark theme and glass-style overrides
- `src/app/(app)/dashboard/page.tsx`: Added `toast.success`/`toast.error` calls for create, delete, and rename tree operations
- `src/components/chat/PendingChange.tsx`: Added toasts for add_node, remove_node, update_node, and checklist accept actions, with error handling
- `src/components/chat/ChatPanel.tsx`: Added toast on "Accept All" showing count of accepted changes
- `package.json` / `package-lock.json`: Added `sonner` dependency

## Commit
cf1e85fe6bc653eada3e5bca8934ca091c7d580c
