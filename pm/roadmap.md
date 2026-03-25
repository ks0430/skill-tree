# SkillForge Changelog
_Auto-exported from SkillForge DB on 2026-03-25. Edit in the DB, not here._

## Phase 1: Core UX Polish
- [x] ITEM-003: Tree rename — allow user to rename a skill tree from the dashboard
- [x] ITEM-004: Tree delete — add delete button with confirmation dialog on dashboard
- [x] ITEM-005: Toast notifications — add a lightweight toast system for success/error feedback (create, delete, save)
- [x] ITEM-002: Empty state for dashboard — show a prompt/CTA when user has no trees yet
- [x] ITEM-006: Node description visible in detail panel — display node description text in NodeDetailPanel below the title
- [x] ITEM-001: Loading state for dashboard — add skeleton loader while skill trees are fetching from Supabase

## Phase 2: AI Improvements
- [x] ITEM-007: acceptAll fix for update_node — acceptAll in ChatPanel only handles add_node; wire up update_node and remove_node cases
- [x] ITEM-008: Persist chat messages to Supabase — currently chat history is in-memory only; save/load from chat_messages table
- [x] ITEM-009: AI context: include current tree nodes in chat prompt — send existing nodes to Claude so it can reference what already exists
- [x] ITEM-010: Suggested follow — up prompts — after AI responds, show 2-3 contextual follow-up suggestions below the reply

## Phase 3: Node Interactions
- [x] ITEM-011: Node status click in 3D canvas — clicking a node cycles its status (locked → in_progress → completed) and persists to Supabase
- [x] ITEM-012: Node progress indicator on planet — show a small visual ring or glow on planets that reflects their checklist completion %
- [x] ITEM-013: Search result highlight — when search finds a node, briefly highlight/pulse it in the canvas (currently just flies camera to it)
- [x] ITEM-014: Pinned node panel persists on refresh — restore pinnedNodeId from localStorage on load

## Phase 4: Tree Management
- [x] ITEM-015: Duplicate tree — add "duplicate" option on dashboard to clone a tree with all its nodes
- [x] ITEM-016: Export tree as JSON — download the full tree (nodes + metadata) as a JSON file
- [x] ITEM-017: Share tree (read — only link) — generate a public share URL that renders the tree in read-only mode
- [x] ITEM-018: Tree thumbnail on dashboard — generate/store a static thumbnail preview for each tree card

## Phase 5: Performance & Quality
- [x] ITEM-027: Wire edges to AI tools — Claude can create depends_on / related edges
- [x] ITEM-019: Memoize SkillNode3D render — wrap in React.memo to prevent unnecessary re-renders when unrelated store state changes
- [x] ITEM-020: Debounce Supabase writes in NodeDetailPanel — checklist toggle fires a DB write per click; debounce to 500ms
- [x] ITEM-022: Mobile layout — basic responsive layout for the tree page on narrow screens (collapse panels, show canvas full-width)
- [x] ITEM-023: Add type column to nodes — migrate role → type, keep backward compat
- [x] ITEM-026: Add properties jsonb to nodes — Supabase migration + TypeScript type update
- [x] ITEM-021: Error boundary for 3D canvas — wrap SkillTreeCanvas in an ErrorBoundary with a fallback UI
- [x] ITEM-025: Edge CRUD in tree store — add/remove/update edges via Zustand + Supabase

## Phase 6: Skill Tree View
- [ ] ITEM-031: Glow shader on node status — locked=dark, in_progress=amber pulse, completed=green glow
- [x] ITEM-032: Edge renderer — glowing lines between nodes, highlight prerequisite path on hover
- [x] ITEM-033: Unlock animation — locked to in_progress transition with particle burst
- [x] ITEM-029: Orthographic top — down camera preset with pan/zoom controls
- [ ] ITEM-034: View switcher UI — toggle between Solar System and Skill Tree

## Phase 7: 3D Gantt View
- [x] ITEM-036: Gantt layout engine — map nodes to time axis positions
- [x] ITEM-035: Date properties UI — add due_date / start_date / estimate to NodeDetailPanel
- [x] ITEM-038: Dependency arrow renderer — depends_on / blocks edges as arrows
- [x] ITEM-039: Today marker — vertical line at current date in Gantt view

## Phase 8: Weight Graph View
- [ ] ITEM-041: Force — directed layout engine (spring physics, repulsion)
- [x] ITEM-042: Edge weight visualisation — line thickness + opacity by weight

## Phase 9: Memory Map View
- [x] ITEM-046: Ambient camera drift — slow auto-rotation when idle
- [x] ITEM-045: Memory map layout — tiered force with edge-type-weighted pull strengths
- [x] ITEM-047: Related/references edge creation UI — quick-link two nodes from detail panel

## Phase 10: PM Loop Integration
- [x] ITEM-050: Flip PM source of truth — pm_cycle.py reads ticket order from SkillForge DB instead of roadmap.md, auto-exports markdown as changelog
- [x] ITEM-052: Skill tree view as world map — dependency graph top-down, locked nodes dark, active pulsing, completed glowing
- [x] ITEM-051: PM loop writes back to SkillForge — ticket start/done syncs node status in real time (extend current mirror to be bidirectional)
- [x] ITEM-049: Board view (Kanban) — Backlog / Active / Done columns with drag-to-reprioritise
