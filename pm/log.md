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

## TICKET-006: Node description visible in detail panel — 2026-03-24
Commit: f6b48c62c7447009b3208bb5c7e0615d1173394b
NodeDetailPanel refactored into `src/components/panel/` with description rendered below the title using `node.data.description` when present.

## TICKET-007: acceptAll fix for update_node — 2026-03-24
Added `removeNode` and `updateNode` from tree-store to the `acceptAll` function in `ChatPanel.tsx`. Previously, bulk accept only handled `add_node` with a TODO comment for the other cases. Now `remove_node` deletes the node and its children from both the store and Supabase, and `update_node` applies field updates to both the store and DB — matching the logic already present in `PendingChange.tsx` for individual accepts.

## TICKET-008: Persist chat messages to Supabase — 2026-03-24
Commit: 4432836ec6073863598ed73f3209dff90a097846
Added chat history loading on mount in ChatPanel — fetches up to 50 messages from Supabase `chat_messages` table and populates the store, completing the save/load cycle.

## TICKET-009: AI context: include current tree nodes in chat prompt — 2026-03-24
Commit: 35af7723f6933467f73a452f13888e01ba55c09b
The `/api/chat` route already fetched all tree nodes and passed them to `buildSystemPrompt`. The system prompt was missing node descriptions — added `descriptionSuffix()` to include each node's `description` field in the hierarchical tree view sent to Claude, giving it full context about every existing node before responding.

## TICKET-010: Suggested follow — 2026-03-24
Commit: f00b65bc1b4fcf83ff7b589be1f41537a0450af0
After each AI response, the API generates 2-3 short contextual follow-up suggestions using claude-haiku. These appear as clickable pill buttons below the conversation. Clicking a suggestion sends it as the next message and clears the suggestions.

## TICKET-011: Node status click in 3D canvas — 2026-03-24
Commit: 911c31d40544d0c8072091eeee51c42b21a6cd3a
Click on any 3D node now cycles its status (locked → in_progress → completed) and immediately persists to Supabase, while still focusing the camera and toggling the pinned detail panel.

## TICKET-012: Node progress indicator on planet — 2026-03-24
Added a billboard progress ring around planets that shows checklist completion as a colored arc (red → yellow → green), with a faint background track, only visible when a node has checklist items.

## TICKET-013: Search result highlight — 2026-03-24
Added a `searchHighlightId` field to the Zustand tree store. When the user selects a node from the search panel, `setSearchHighlight` is called alongside `setFocusTarget`. This sets a node ID that auto-clears after 2.5s via `setTimeout`. In `SkillNode3D`, a pulse ring mesh is rendered and animated in `useFrame`: it expands from 1× to 3× the node's scale while fading from 70% opacity to 0 over 2.5 seconds, giving a clear ripple-out visual cue after the camera flies to the node.

## TICKET-014: Pinned node panel persists on refresh — 2026-03-24
Modified `setPinnedNode` in `tree-store.ts` to write/remove `pinnedNodeId` in localStorage on every change, and initialized the store's `pinnedNodeId` field by reading from localStorage at startup (SSR-safe via `typeof window !== "undefined"` guard).

## TICKET-015: Duplicate tree — 2026-03-24
Adds a "Duplicate" button on the dashboard that clones a skill tree with all its nodes into a new galaxy named "Copy of {original name}".

## TICKET-016: Export tree as JSON — 2026-03-24
Commit: 99d8808
Added a client-side JSON export to the tree page. Clicking "Export JSON" in the header downloads `<tree-name>.json` containing the tree ID, name, export timestamp, and the full nodes array. Uses the Zustand store's in-memory nodes (already loaded on mount), so no extra DB call needed. Filename is slugified from the tree name.

## TICKET-017: Share tree (read-only link) — 2026-03-24
Added public share links for skill trees. Clicking "🔗 Share" in the tree header copies a `/share/<id>` URL to the clipboard. Anyone with the link can view the full 3D galaxy in read-only mode — no login required, no editing possible. The share API uses the Supabase service role key to bypass RLS, exposing only safe read-only fields.

## TICKET-018: Tree thumbnail on dashboard — 2026-03-24
Commit: 7314ec7
Added a canvas-based `TreeThumbnail` component that renders a deterministic 2D minimap of each tree card. Stellars appear as glowing dots with status-based colors; planets orbit them as small dots. The dashboard loads stellar+planet nodes per tree and passes them to the thumbnail. Fully client-side — no DB storage needed.

## TICKET-019: Memoize SkillNode3D render — 2026-03-24
Commit: c58ce6c
The component was already exported as `memo(function SkillNode3D(...))` from a previous commit, but one `useTreeStore()` call was subscribing to the entire store object without a selector. This caused every SkillNode3D instance to re-render on any store state change (e.g., camera tracking, chat panel state, pending changes), defeating the memo entirely.

Fix: split the broad destructure into five individual selector calls. Now each node only re-renders when one of the five specific store slices it cares about actually changes. This is consistent with the `searchHighlightId` selector already in the file.

## TICKET-020: Debounce Supabase writes in NodeDetailPanel — 2026-03-24
Commit: 6afe7be
Checklist toggles previously called `persist` on every click, firing a Supabase write immediately each time. Rapid toggling could cause multiple in-flight writes with stale data arriving out of order.

The fix splits the concern: `writeToDb` handles only the DB write, while `persist` (used by add/remove/AI generate) still does both in sequence. `handleToggle` now updates local state immediately for snappy UI, then debounces the DB write to 500ms using a `useRef`-held timer. Each new toggle cancels the previous pending write, so only the final state within a burst is persisted. Zero regressions to add/remove/AI generate paths.

## TICKET-021: Error boundary for 3D canvas — 2026-03-24
Commit: a1791ba
Created `CanvasErrorBoundary`, a React class component (required for `componentDidCatch` / `getDerivedStateFromError`), that wraps `SkillTreeCanvas` in the tree page. If the Three.js/R3F canvas throws during render, the user sees a themed fallback ("Galaxy failed to render" with the error message and a Retry button) instead of a blank screen or uncaught crash. The retry button resets component state to re-attempt rendering. Styling follows the existing `glass`, `font-mono`, and `border-glass-border` conventions.

## TICKET-022: Mobile layout — 2026-03-24
Commit: 5e3c7a7238f7c5752d92bbf39c805818e370e94d
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
