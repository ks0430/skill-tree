# SkillForge — PM Log

Append-only log of completed tickets.

---

## TICKET-001: Loading state for dashboard — 2026-03-24
Replaced the plain "Loading..." placeholder with a skeleton loader showing 3 pulsing glass-style cards. Each skeleton card matches the structure of a real tree card (name, description, stats row, progress bar), giving users a clear sense of the incoming layout while Supabase fetches data.

## TICKET-002: Empty state for dashboard — 2026-03-24
Upgraded the dashboard empty state from a plain text stub to a centred, visually engaging CTA. When the user has no skill trees, they now see a large galaxy emoji, a welcoming headline, a short description, and a ready-to-use create form — all with a smooth fade-in animation consistent with the rest of the UI.

## TICKET-003: Tree rename — 2026-03-24
Commit: d6ae12bde16faf765896a600fa0d4e6f8102363c
Added inline rename to dashboard tree cards. Hovering a card reveals a ✏️ pencil button next to the tree name. Clicking it enters an inline input (pre-selected) — press Enter or blur to save, Escape to cancel. Optimistic UI update + Supabase persist via `skill_trees.update`.

## TICKET-004: Tree delete — 2026-03-24
Added a confirmation dialog modal to the dashboard delete flow. Clicking the Delete button now opens an animated modal (matching existing glass/Framer Motion style) asking the user to confirm before permanently deleting a galaxy and all its nodes.

## TICKET-005: Toast notifications — 2026-03-24
Installed `sonner` and wired up toast notifications throughout the app: galaxy create/delete/rename on dashboard, and node add/remove/update/checklist accept in the chat panel. The `<Toaster>` is mounted in root layout with dark theme matching the app's glass aesthetic.
