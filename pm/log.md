# SkillForge — PM Log

Append-only log of completed tickets.

---

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

## TICKET-023: Add type column to nodes — 2026-03-24
Commit: 35a134d1e2c607eb06b004ca107d557fa78b85de
Migration 004 had already added the `type` column to `skill_nodes` and backfilled it from `role`. This ticket wires up the frontend to prefer `type` everywhere while falling back to `role` for any legacy rows where `type` might be null.

Key decisions:
- **Dual-write**: when creating or updating nodes, both `type` and `role` are written with the same value so the DB stays consistent regardless of which column other queries read.
- **`type ?? role` pattern**: all read paths use this fallback so nothing breaks if `type` is ever null on an older row.
- **`NodeType` = `NodeRole`**: the new type alias starts as identical to `NodeRole` but leaves the door open to expand the union later (e.g. add "concept", "milestone").
- **TypeScript clean**: `npx tsc --noEmit` passes with zero errors after all changes.

## TICKET-024: Edge CRUD in tree store — 2026-03-24
Commit: 05411f9
Added full edge CRUD to the Zustand tree store with Supabase persistence. The `SkillEdge` type was extended to reflect the `type` and `weight` columns added in migration 004. Three async actions were added to the store — `addEdge`, `removeEdge`, `updateEdge` — each using an optimistic update pattern (apply locally first, roll back on Supabase error). A `setEdges` setter and `edges` state field were also added. The tree page now fetches edges alongside nodes on load, so edge state is fully hydrated on entry. No changes to rendering or AI tooling — edges are available for future views without touching existing orbital rendering.

## TICKET-025: Add properties jsonb to nodes — 2026-03-24
Commit: 9de8442390154988f5dfff3c4ec2039e187df03e
Added `properties` jsonb field to the `SkillNode` TypeScript interface (migration 004 already added the column to the DB). Updated the two places in the codebase (`PendingChange.tsx`, `ChatPanel.tsx`) that construct `SkillNode` literals to include `properties: {}` as the default value.

## TICKET-026: Wire edges to AI tools — 2026-03-24
Commit: 7beb792
Added two new AI tools (`add_edge` / `remove_edge`) so Claude can create and remove explicit relationship edges between skill nodes. The tools expose only the two most useful edge types: `depends_on` (prerequisite ordering) and `related` (loose thematic connection). These flow through the existing pending-change review pipeline — Claude proposes an edge, the user sees it as a cyan-highlighted pending change with an Accept/Reject button, and on accept it's persisted to Supabase via the existing `tree-store.addEdge` / `removeEdge` methods. The system prompt was updated with clear rules on when to use each type and how to form edge IDs. TypeScript compiles cleanly with no regressions.

## TICKET-027: Orthographic top — 2026-03-24
Commit: cf0a3d2
Added an orthographic top-down camera preset to the 3D skill tree canvas.

When activated (via the `⊤` button in the bottom-right corner or the `T` keyboard shortcut), the camera smoothly flies to a bird's-eye position directly above the current view target, then locks into top-down mode. In this mode:
- Rotation is disabled (camera stays overhead)
- Pan is fully enabled so users can explore the skill tree by dragging
- Zoom (scroll wheel) continues to work normally
- The camera actively enforces overhead position each frame so it can't drift

The toggle button lights up indigo when active and reverts to the default slate style when off. Pressing `T` again or clicking the button returns to normal perspective mode with rotation restored.

State (`topDownMode`) lives in the Zustand tree store so it's accessible from anywhere. The implementation reuses the existing fly-to lerp animation system for a smooth transition.

## TICKET-028: Glow shader on node status — 2026-03-24
Commit: 7ce4297
Added a status-driven glow effect to 3D skill nodes in `SkillNode3D.tsx`. A new `statusGlowRef` mesh (using the existing `sharedGeo.atmosphere` geometry at 1.35x node scale, BackSide rendering) is animated each frame via `useFrame`:
- **locked**: glow hidden (no extra cost)
- **in_progress**: amber (#ffaa22) pulse — opacity oscillates between 0.12 and 0.34 using `Math.abs(Math.sin(t * 2.5))`
- **completed**: green (#00ff88) steady glow with subtle breathing (opacity ~0.18 ± 0.04)

Reused the existing atmosphere mesh pattern and `meshBasicMaterial` transparent approach already used for hover glow and search highlight, keeping code consistent. No new geometry or materials introduced beyond the one extra mesh per node.

## TICKET-029: Edge renderer — 2026-03-24
Commit: f76cc08
Built a new `EdgeRenderer` component that draws glowing lines between skill nodes using `THREE.Line` with `AdditiveBlending`. Lines track animated orbital positions in real-time each frame via the existing `worldPositions` map. On hover, the component walks the `depends_on` edge graph to collect the full prerequisite chain and highlights those edges while fading all others — giving a clear visual path showing what a node depends on. Parent-type edges are intentionally skipped since orbital rings already communicate the hierarchy. TypeScript was clean on first compile pass after switching from JSX `<line>` (which TS maps to SVG) to `<primitive object={lineObj} />`.

## TICKET-030: Unlock animation — 2026-03-24
Commit: ab067b4
Added an unlock animation that fires a particle burst whenever a skill node transitions from `locked` to `in_progress` status. The `UnlockParticles` component creates 48 points with randomised directions on a unit sphere, animates them outward over 1.4 seconds (scaled to node size), and fades their opacity to zero before cleaning up. A `prevStatusRef` in `SkillNode3D` tracks the previous status so the burst fires exactly once per unlock event. The burst colour is warm amber (`#ffcc44`) to complement the existing in_progress amber glow.

## TICKET-031: View switcher UI — 2026-03-24
Commit: a5bf402
Added a view switcher that lets users toggle between the existing 3D Solar System canvas and a new flat 2D Skill Tree diagram.

The 2D view (`SkillTreeView2D`) computes a top-down hierarchical tree layout from the same node data used by the 3D view — stellars are roots, planets their children, satellites their grandchildren. Layout is computed with a bottom-up width-measure pass then a top-down position pass, with bezier curve edges drawn on an SVG layer. The view supports drag-to-pan and scroll-to-zoom, and reuses the existing `NodeDetailPanel` and `SearchPanel` components so all detail/search functionality carries over.

The toggle is a segmented button group ("🪐 Solar / 🌿 Tree") placed in the page header, consistent with the existing button style. Selection persists to `localStorage` so the user's preferred view survives page refreshes. No regressions to the 3D solar view.

## TICKET-032: Date properties UI — 2026-03-24
Commit: 29a8415
Added a `PanelDates` component that shows `start_date`, `due_date`, and `estimate` fields in the `NodeDetailPanel`. Fields are read from `node.data.properties` (the existing jsonb column in Supabase). In editable mode, clicking any field activates an inline input (date picker for dates, free text for estimate); changes are optimistically committed to the tree store and persisted to Supabase. In read-only mode, the section is hidden when no dates are set. No schema changes required — the `properties` column already exists.

## TICKET-033: Gantt layout engine — 2026-03-25
Commit: 04190c00385633ac99ab22163cf817a80289eb35
Added Gantt layout engine (`src/lib/gantt/layout.ts`) that maps nodes to horizontal time-bar positions using `start_date`, `due_date`, and `estimate` from node properties. Created `GanttView.tsx` with scrollable timeline, month axis ticks, today marker, status-fill bars, and pinnable node detail panel. Added "📅 Gantt" view mode button to the tree page alongside Solar and Tree views.

## TICKET-034: Install dagre + rebuild SkillTreeView2D — 2026-03-25
Commit: fa39ecd
Installed dagre (v0.8.5) and rewrote `SkillTreeView2D` to use a proper directed graph layout. The component now reads the `edges` array from the tree store and filters for `depends_on` type edges to build a dagre `TB` (top-to-bottom) directed graph — prerequisites appear above their dependents, showing the dependency flow rather than arbitrary phase grouping. When no dependency edges exist, it automatically falls back to using `parent_id` relationships so existing trees still render correctly. Edges are rendered as smooth polyline paths with SVG arrowhead markers. All pan/zoom interaction, node selection, search highlighting, and the detail panel are preserved unchanged.

## TICKET-035: Single root node — 2026-03-25
Commit: d58a59c
Added a virtual ROOT node to the 2D tree layout in `SkillTreeView2D.tsx`. Previously each stellar node was an independent root in the dagre graph, causing multiple disconnected tree tops. Now a hidden `__ROOT__` node sits above all stellars — dagre treats it as the single origin and arranges all stellars as its children, giving the tree one unified flow from the top downward. The ROOT node is injected with zero dimensions and its edges are filtered out before rendering, so the visual output is unchanged except all stellars now align under a single hierarchical root.

## TICKET-036: Visible edge lines — 2026-03-25
Commit: 7c92c3b
The 2D tree view (SkillTreeView2D) already had the SVG edge infrastructure in place — dagre layout was computing waypoints and the SVG `<path>` elements existed — but edges were nearly invisible due to low opacity (0.3) and the bezier curve function had dead code that fell back to straight line segments instead of smooth curves.

Fixed by:
1. Rewriting `pointsToPath` to use quadratic bezier curves via midpoints (standard smooth polyline technique)
2. Raising stroke opacity to 0.7 for clear visibility on the dark `#0a0e1a` background
3. Making arrowheads larger and more opaque so dependency direction (prerequisite → dependent) is easy to read at a glance

## TICKET-037: Node glow by status — 2026-03-25
Commit: 6704646
Added status-driven glow effects to the 2D skill tree view to match the game skill tree aesthetic:

- **locked** — dark/muted: darker background, reduced opacity (55%), muted slate status dot. No glow.
- **in_progress** — amber pulse: CSS keyframe animation pulses an amber box-shadow in and out (~1.8s cycle), matching the amber colour already used in the 3D view's `useFrame` glow.
- **completed** — green glow: gentle steady green box-shadow with a slow breathing animation (~2.4s cycle), using the same green (#34d399) as the planet/satellite type border colour.

The 3D view (`SkillNode3D.tsx`) already had equivalent glow logic in its `useFrame` animation loop — this ticket brings the 2D flat view up to parity. Implementation is purely CSS + class names; no JS animation loops required for the 2D view.

## TICKET-038: Hover path highlight — 2026-03-25
Commit: 01b07b5
Implemented hover path highlighting in the 2D skill tree view. When a user hovers over any node, the full unlock chain (all ancestors it depends on, plus all descendants that depend on it) is highlighted in indigo — nodes glow and edges turn purple — while everything outside the chain fades to near-invisible. Uses BFS traversal on the `depends_on` edge graph in both directions. No store changes required; hover state is local to the component for performance and to avoid coupling with the 3D solar view.

## TICKET-039: Dependency arrow renderer — 2026-03-25
Commit: 45b58a2
Rendered `depends_on` and `blocks` edges as directional arrows in both the 3D solar canvas and the 2D dagre view.

**3D (EdgeRenderer):** Added `THREE.ConeGeometry` arrowhead meshes for directional edge types. Each cone is positioned near the target end (85% along the line) and oriented each frame using `quaternion.setFromUnitVectors` to point source→target. Arrowheads inherit the same additive-blended colour and opacity as their line, so they participate in hover highlighting automatically. `blocks` path traversal was also added to `collectPrereqPath` so blocker chains highlight correctly on hover.

**2D (SkillTreeView2D):** `blocks` edges were previously silently ignored by dagre — they're now included with the correct layout direction (blocker ranks above blocked node). Each edge carries its `type` through `posEdges`. Rendering picks type-specific SVG arrowhead markers (violet for `depends_on`, red for `blocks`) and renders `blocks` edges with a dashed stroke to distinguish them visually from dependency edges. Hover chain highlighting was extended to cover both edge types.

**Design decisions:** Arrowheads point at the *target* end (conventional for dependency graphs). Dashed style for `blocks` keeps the distinction legible at a glance without adding a legend. Cone geometry is shared as a module-level constant to avoid per-edge GC pressure.

## TICKET-040: Today marker — 2026-03-25
Commit: e02ab49
The Gantt view already had the amber "Today" vertical line and label from the TICKET-033 layout engine, but the view always opened at scroll position 0 (the epoch), so the marker was off-screen for any tree with near-term work. This ticket adds auto-scroll-to-today on mount: a `useEffect` calculates the scroll position needed to center today in the visible timeline, setting it once at load. The today line itself was also polished — higher opacity, slightly thicker, and a subtle amber glow — so it reads clearly against the Gantt bars.

## TICKET-041: Force — 2026-03-25
Commit: 694a98e
Built a self-contained force-directed layout engine (`src/lib/force/layout.ts`) using spring physics: every node pair repels via an inverse-square Coulomb force, and every edge acts as a Hooke spring with stiffness proportional to `edge.weight`. The engine is split into `computeForceLayout` (runs to near-convergence, used for initial placement) and `stepForce` (single tick, used for animated settling in the component). Nodes are seeded on a circle with a deterministic LCG jitter to avoid symmetric deadlocks.

`WeightGraphView.tsx` renders the graph as an SVG: node size grows with connection degree (capped at 44 px radius), edge stroke width encodes weight (1–6 px), and hover illuminates a node's immediate neighbours. The component kicks off the batch layout on mount and then continues ticking with `requestAnimationFrame` until velocities decay below 0.15 px/tick, giving a smooth settling animation. Shares pan/zoom, pinned-panel, and search-highlight infrastructure with the existing 2D views.

View mode was extended from a 3-way to 4-way union (`solar | tree | gantt | weight`) with a 🕸️ Graph button added to the existing view switcher in the tree page.

## TICKET-042: Edge weight visualisation — 2026-03-25
Commit: 02be716
Added edge weight visualisation across both the 2D SVG force graph (`WeightGraphView`) and the 3D Three.js canvas (`EdgeRenderer`). Edges now vary in both line thickness (already done for 2D, extended to 3D) and opacity (new for both views): high-weight edges are thicker and more opaque, low-weight edges are thinner and more transparent. The weight range 0–1 maps to opacity 0.25–0.85 in 2D and 0.15–0.65 in 3D, with highlighted/hovered edges still boosting to full opacity. Dimmed (non-hovered) edges use a tighter fade to preserve contrast.

## TICKET-043: Memory map layout — 2026-03-25
Commit: f423d63
Built the Memory Map view — a force-directed layout where edge type determines pull strength rather than a uniform spring constant. The core change is `computeMemoryMapLayout()` which pre-multiplies each edge's weight by `MEMORY_MAP_PULL_STRENGTH[edgeType]` before running the standard spring-physics simulation. This means `parent` edges (×2.0) cluster children tightly to their parent node, while `related` (×0.5) and `references` (×0.3) edges provide only a soft associative drift — giving the layout an Obsidian-graph-like feel where hierarchy and loose association coexist visually. The view is wired into the existing view switcher as a fifth mode (`🧠 Memory`).

## TICKET-044: Ambient camera drift — 2026-03-25
Commit: f6d42f4
Added ambient camera drift to the 3D skill tree canvas. When the user hasn't interacted (mouse, scroll, touch, keyboard) for 5 seconds and isn't in tracking or top-down mode, `OrbitControls.autoRotate` is enabled with a slow `autoRotateSpeed` of 0.3 — giving a gentle planetary drift effect. Any user interaction immediately resets the idle timer and stops the drift on the next frame. Top-down mode and node-tracking mode are unaffected, since they already control camera movement themselves.

## TICKET-045: Related/references edge creation UI — 2026-03-25
Commit: c99b27f
Added a `PanelRelations` component that renders inside the node detail panel whenever the panel is not in read-only mode. It lets users:

1. **View** all existing non-parent edges connected to the current node, showing direction (→ source / ← target), type colour dot, the other node's label, and a remove button.
2. **Create** a new edge by typing a search query to find another node (live-filtered, excluding already-linked nodes and self), selecting a node from the dropdown, choosing one of four edge types (related, references, depends_on, blocks), and clicking "+ Link node".

The component reads from and writes to the existing `addEdge` / `removeEdge` store actions, which already handle optimistic updates and Supabase persistence. No schema or API changes were needed. The section collapses by default (▼/▲ toggle) and shows a count badge when there are existing relations.

## TICKET-046: Board view (Kanban) — 2026-03-25
Commit: 53b5525
Built a Kanban board view as the sixth view mode in SkillForge. The board shows three columns — Backlog (locked nodes), Active (in_progress), and Done (completed) — each sorted by priority descending. Cards support native HTML5 drag-and-drop: dragging a card between columns updates its status, and dragging within a column reorders by recalculating priority as a midpoint between neighbours. Drop indicator lines show exactly where the card will land. Priority and status changes are persisted optimistically to Supabase via the existing `updateNode` store method plus a direct supabase update call. Cards show node label, type (colour-coded), priority value, icon, and description snippet. Clicking a card pins the NodeDetailPanel. The view is consistent with the existing dark glass aesthetic used across Gantt, Weight, and Memory views.

## TICKET-047: Flip PM source of truth — 2026-03-25
Commit: 82cef93
Flipped the PM loop so it reads pending work from the SkillForge Supabase DB (planet nodes with status=locked, ordered by phase then id) rather than parsing roadmap.md. roadmap.md is now auto-generated as a changelog mirror after each cycle tick when SkillForge is enabled. Falls back to the original roadmap.md parsing when SF is not configured, preserving backward compatibility. The DB is now the single source of truth for ticket ordering.

## TICKET-048: Empty state for dashboard — 2026-03-25
Commit: bd330a6
The empty state UI (galaxy emoji, heading, description copy, inline create CTA) was already in place from TICKET-002. This ticket polished it by adding clickable example name chips below the create button. Clicking a chip prefills the input with a suggested galaxy name, reducing friction for first-time users who don't know what to call their first tree. Chips are styled as small rounded pills consistent with the existing glass/navy palette.

## TICKET-049: Node description visible in detail panel — 2026-03-25
Commit: b656262
The `node.data.description` field was already being conditionally rendered in `NodeDetailPanel.tsx` (from TICKET-006), but the paragraph lacked vertical spacing, causing it to feel cramped against the title above and the status badge below. Added `mt-1 mb-3` Tailwind classes to give the description proper breathing room below the title. The description only renders when non-null/non-empty, consistent with the existing pattern.

## TICKET-050: Memoize SkillNode3D render — 2026-03-25
Commit: 7f2fa84
The component was already wrapped with `React.memo` (from TICKET-019), but two store subscriptions were still too broad: subscribing to the full `pinnedNodeId` string and `searchHighlightId` string caused every `SkillNode3D` instance to re-render whenever any node was pinned or a search result changed, because the selector returned a new value for all instances.

The fix narrows both selectors to return booleans (`isPinned`, `isSearchHighlight`) — each node now only re-renders when its own pin/highlight state changes, not when other nodes' states change. This makes `React.memo` effective for these two common interaction patterns.

## TICKET-051: Error boundary for 3D canvas — 2026-03-25
Commit: 544f3ed
`CanvasErrorBoundary` already existed as a class component in `src/components/ui/CanvasErrorBoundary.tsx` with a fallback UI (galaxy emoji, error message, retry button). It was already applied to `SkillTreeCanvas` in the authenticated tree page. The only gap was `ReadOnlyCanvas` on the public share page — that canvas had no error protection.

Added `CanvasErrorBoundary` import and wrapped `<ReadOnlyCanvas />` in `src/app/share/[id]/page.tsx`. Now both 3D canvas surfaces (authenticated and read-only share) are covered by the error boundary with a consistent fallback UI.

## TICKET-052: Today marker — 2026-03-25
Commit: 3c02f89
The vertical today marker in the Gantt view was originally implemented in TICKET-040. This ticket (TICKET-052) enhanced the axis label from a plain text "Today" to a styled date chip (amber pill showing "MMM D" format). This makes the current date visually anchored and immediately readable without hovering. The chip is rendered inline using `toLocaleDateString` with `en-US` locale for consistent short-month format.

## TICKET-053: PM loop writes back to SkillForge — 2026-03-25
Commit: 062a7704b8adf0dcc1ed3584629a1732a718a4a3
Changed sf_get_pending_items to query skill_nodes where status=locked and type=planet, ordered by priority ASC (from the SkillForge UI). Previously ordered by phase/id which ignored user-set priority. Also updated sf_export_changelog to order by priority for consistency. roadmap.md is written to as a changelog when items complete, no longer used as execution order source.

## TICKET-054: Skill tree view as world map — 2026-03-25
Commit: 00b1c88b90e694519348661eb0140d774c253ed7
Built a new "World Map" view accessible via the 🗺️ Map button in the view switcher. The view uses the same dagre dependency graph layout as the 2D tree view (top-to-bottom flow) but renders nodes as RPG-style landmark circles rather than flat rectangles.

**Node visual states:**
- **Locked** — dark `#1a1a2e` fill with fog-of-war dot/hatch overlay patterns and a 🔒 icon; desaturated, clearly inaccessible
- **In Progress (active)** — warm amber fill with a CSS-animated pulsing ring (`wm-pulse-ring`) that expands and fades on a 1.8s loop; text in gold
- **Completed** — deep green fill with a steady CSS-animated glow halo (`wm-glow-ring`) on a 2.4s loop; text in mint green
- **Available** — muted navy fill with slate-blue border

**Connectors:** Road-style paths — a wide dark shadow lane under a thinner coloured surface lane. `depends_on` edges use teal-ish colour, `blocks` edges use dashed red. Both carry arrowheads.

**Decorations:** Subtle dot-grid background, outer decorative rings per node (solid for stellar, dashed for planet/satellite), compass rose in the bottom-right corner of the layout.

Decisions: re-used dagre layout logic from `SkillTreeView2D` rather than duplicating the force layout from `MemoryMapView` — top-down tree is the right shape for a "path through the world" metaphor. SVG-based to keep animation smooth without WebGL overhead.

## TICKET-055: Wire edges to AI tools — 2026-03-25
Commit: dc8e0e2
The `add_edge` and `remove_edge` tools were already defined in `tools.ts` and wired up in `PendingChange.tsx` and `ChatPanel.tsx` to apply/persist edge changes. What was missing was Claude having visibility into the existing edges when deciding whether to create new ones. This change loads the tree's edges in the chat route and injects them into the system prompt, giving Claude full context of existing `depends_on` and `related` connections before it responds. No new types or components were needed — just plumbing the data through the existing prompt builder.

## TICKET-056: Orthographic top — 2026-03-25
Commit: 6a6a725
Upgraded the existing top-down camera preset from a perspective camera locked overhead to a true orthographic projection. When the user presses `T` (or the ⊤ button), a `drei` `OrthographicCamera` replaces the default perspective camera and a `OrthoZoomSync` component keeps its frustum bounds in sync with an `orthoZoom` store value. Two overlay buttons (`+` / `−`) allow stepwise zoom in and out. Pan still works via mouse drag (OrbitControls, rotation locked). Exiting top-down mode restores the original perspective camera automatically.

## TICKET-057: Glow shader on node status — 2026-03-25
Commit: 0c6ad01
Added a per-node status glow using the existing shared atmosphere sphere geometry. The glow mesh sits just outside the planet at 1.35× scale and is driven in `useFrame` each frame: locked nodes keep it invisible (dark/dormant feel), in-progress nodes get an amber pulse with a faster sin cycle, and completed nodes get a calm green steady glow. No new geometry or shader was needed — reused `sharedGeo.atmosphere` with a `meshBasicMaterial` color swap and opacity animation.

## TICKET-058: View switcher UI — 2026-03-25
Commit: 9b360c2
Extracted the inline view-mode button group from the tree page into a standalone `ViewSwitcher` component. The 7-view segmented toggle (🪐 Solar, 🌿 Tree, 📅 Gantt, 🕸️ Graph, 🧠 Memory, 📋 Board, 🗺️ Map) now lives in its own file, reads state directly from `useTreeStore`, and is referenced from the page with a single element. The view options array makes it easy to add future views without touching the render logic. Behaviour is identical to before — active view is highlighted in indigo, all transitions work, and TypeScript compiles clean with no regressions.
