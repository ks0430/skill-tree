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
- [x] ITEM-008: Persist chat messages to Supabase — currently chat history is in-memory only; save/load from chat_messages table
- [x] ITEM-007: acceptAll fix for update_node — acceptAll in ChatPanel only handles add_node; wire up update_node and remove_node cases
- [x] ITEM-009: AI context: include current tree nodes in chat prompt — send existing nodes to Claude so it can reference what already exists
- [x] ITEM-010: Suggested follow — up prompts — after AI responds, show 2-3 contextual follow-up suggestions below the reply

## Phase 3: Node Interactions
- [x] ITEM-011: Node status click in 3D canvas — clicking a node cycles its status (locked → in_progress → completed) and persists to Supabase
- [x] ITEM-012: Node progress indicator on planet — show a small visual ring or glow on planets that reflects their checklist completion %
- [x] ITEM-013: Search result highlight — when search finds a node, briefly highlight/pulse it in the canvas (currently just flies camera to it)
- [x] ITEM-014: Pinned node panel persists on refresh — restore pinnedNodeId from localStorage on load

## Phase 4: Tree Management
- [x] ITEM-017: Share tree (read — only link) — generate a public share URL that renders the tree in read-only mode
- [x] ITEM-018: Tree thumbnail on dashboard — generate/store a static thumbnail preview for each tree card
- [x] ITEM-015: Duplicate tree — add "duplicate" option on dashboard to clone a tree with all its nodes
- [x] ITEM-016: Export tree as JSON — download the full tree (nodes + metadata) as a JSON file

## Phase 5: Performance & Quality
- [x] ITEM-020: Debounce Supabase writes in NodeDetailPanel — checklist toggle fires a DB write per click; debounce to 500ms
- [x] ITEM-022: Mobile layout — basic responsive layout for the tree page on narrow screens (collapse panels, show canvas full-width)
- [x] ITEM-023: Add type column to nodes — migrate role → type, keep backward compat
- [x] ITEM-026: Add properties jsonb to nodes — Supabase migration + TypeScript type update
- [x] ITEM-021: Error boundary for 3D canvas — wrap SkillTreeCanvas in an ErrorBoundary with a fallback UI
- [x] ITEM-025: Edge CRUD in tree store — add/remove/update edges via Zustand + Supabase
- [x] ITEM-019: Memoize SkillNode3D render — wrap in React.memo to prevent unnecessary re-renders when unrelated store state changes
- [x] ITEM-027: Wire edges to AI tools — Claude can create depends_on / related edges

## Phase 6: Skill Tree View
- [x] ITEM-032: Edge renderer — glowing lines between nodes, highlight prerequisite path on hover
- [x] ITEM-033: Unlock animation — locked to in_progress transition with particle burst
- [x] ITEM-029: Orthographic top — down camera preset with pan/zoom controls
- [x] ITEM-031: Glow shader on node status — locked=dark, in_progress=amber pulse, completed=green glow
- [x] ITEM-034: View switcher UI — toggle between Solar System and Skill Tree

## Phase 7: 3D Gantt View
- [x] ITEM-036: Gantt layout engine — map nodes to time axis positions
- [x] ITEM-035: Date properties UI — add due_date / start_date / estimate to NodeDetailPanel
- [x] ITEM-038: Dependency arrow renderer — depends_on / blocks edges as arrows
- [x] ITEM-039: Today marker — vertical line at current date in Gantt view

## Phase 8: Weight Graph View
- [x] ITEM-042: Edge weight visualisation — line thickness + opacity by weight
- [x] ITEM-041: Force — directed layout engine (spring physics, repulsion)

## Phase 9: Memory Map View
- [x] ITEM-046: Ambient camera drift — slow auto-rotation when idle
- [x] ITEM-045: Memory map layout — tiered force with edge-type-weighted pull strengths
- [x] ITEM-047: Related/references edge creation UI — quick-link two nodes from detail panel

## Phase 10: PM Loop Integration
- [x] ITEM-050: Flip PM source of truth — pm_cycle.py reads ticket order from SkillForge DB instead of roadmap.md, auto-exports markdown as changelog
- [x] ITEM-052: Skill tree view as world map — dependency graph top-down, locked nodes dark, active pulsing, completed glowing
- [x] ITEM-051: PM loop writes back to SkillForge — ticket start/done syncs node status in real time (extend current mirror to be bidirectional)
- [x] ITEM-049: Board view (Kanban) — Backlog / Active / Done columns with drag-to-reprioritise

## Phase 11: Core — Supabase Source of Truth + Realtime
- [ ] ITEM-061: [HIGH] KanbanView CSS border conflict — replace shorthand border with separate borderTop/borderRight/borderBottom/borderLeft at lines 264 and 313 in KanbanView.tsx
- [ ] ITEM-063: Extend skill_nodes properties for ticket metadata — store commit_hash, agent_id, started_at, completed_at inside existing properties jsonb field; add migration to document expected shape
- [ ] ITEM-064: PM cycle writes ticket data to skill_nodes — on ticket create: update node status to in_progress + write brief as content blocks; on ticket complete: set status=completed, write summary block, store commit_hash/completed_at in properties
- [ ] ITEM-087: agent_events table in Supabase — id, tree_id, node_id, event_type (started/progress/completed/error), message, agent_id, created_at; service role write access
- [ ] ITEM-088: PM cycle writes agent events — on ticket start/progress/done, insert row to agent_events with node_id + message; coding agent posts via Supabase REST
- [ ] ITEM-089: Supabase Realtime subscription in SkillForge — subscribe to agent_events channel; on event received update node status in store + trigger pulse animation
- [ ] ITEM-090: Agent activity feed UI — live sidebar feed showing stream of agent events (🔍 ⚙️ 📦 ✅) sourced from Supabase Realtime
- [ ] ITEM-091: Node pulse animation on agent event — ring/glow pulse on node in canvas when agent_event arrives for that node_id
- [ ] ITEM-065: Flip PM source of truth to Supabase — user can reorder by updating priority in SkillForge UI; roadmap.md auto-exported as changelog
- [ ] ITEM-066: Ticket detail view in SkillForge — clicking a node shows full ticket: brief + acceptance criteria from content.blocks[], commit hash + timestamps from properties, live progress from agent_events

## Phase 12: Skill Tree View
- [ ] ITEM-055: Install dagre + rebuild SkillTreeView2D — replace column layout with dagre directed graph; nodes positioned by dependency flow not phase grouping
- [ ] ITEM-056: Single root node — add a virtual ROOT node all phase stellars connect to, so the tree flows from one origin point upward
- [ ] ITEM-057: Visible edge lines — render SVG lines between connected nodes in tree view with arrowheads showing dependency direction
- [ ] ITEM-058: Node glow by status — locked=dark/muted, in_progress=amber pulse, completed=green glow
- [ ] ITEM-059: Hover path highlight — on hover, highlight the full unlock chain (ancestors + descendants)

## Phase 13: Bug Fixes
- [ ] ITEM-062: Light mode — add light/dark theme toggle; persist preference to localStorage; update Tailwind config and CSS variables
- [ ] ITEM-060: UnlockParticles useFrame crash — guard against position attribute not yet initialised at SkillNode3D.tsx:64

## Phase 14: Supabase PM Integration
- [ ] ITEM-067: /pm status command — coding bot replies with current ticket, roadmap progress, next 3 pending items
- [ ] ITEM-068: /pm pause and /pm resume commands — disable/enable cron job from Telegram group
- [ ] ITEM-069: /pm next command — skip current ticket, mark as deferred, advance to next item
- [ ] ITEM-070: /pm priority <ITEM — NNN> command — move an item to top of queue

## Phase 15: AI Assistant Tool Expansion
- [ ] ITEM-071: manage_relationship tool — AI can create/remove typed edges (depends_on, related, references) between nodes
- [ ] ITEM-072: update_content tool — AI updates node content blocks (checklist items, notes) separately from node metadata
- [ ] ITEM-073: update_properties tool — AI updates structured node properties (due_date, assignee, priority, status)
- [ ] ITEM-074: Split chat tools into focused actions — refactor add_node/update_node/remove_node to use new granular tools

## Phase 16: Rich Text + Ticket Content in Supabase
- [ ] ITEM-075: Paragraph and heading content blocks — add paragraph/heading block types to NodeContent, render in NodeDetailPanel
- [ ] ITEM-076: Rich text renderer in NodeDetailPanel — render paragraph, heading, checklist blocks with proper formatting
- [ ] ITEM-077: Ticket history timeline — show commit history + progress updates in node detail panel, sourced from agent_events

## Phase 17: Content System Unification
- [ ] ITEM-079: Merge checklist into rich content system — remove separate checklist structure, treat as a content block type within blocks[]
- [ ] ITEM-080: Content block types — paragraph, heading, checklist, code, divider; TypeScript types and renderers
- [ ] ITEM-081: Inline content editing — click any content block to edit in-place; save to Supabase on blur

## Phase 18: Project Workspace Hierarchy
- [ ] ITEM-082: projects table in Supabase — id, user_id, name, description, icon, created_at; RLS policy
- [ ] ITEM-083: Link skill_trees to projects — add project_id FK to skill_trees; migration for existing trees
- [ ] ITEM-084: Projects dashboard — replace tree list with projects list; click project to see its trees
- [ ] ITEM-085: Project switcher in tree view — breadcrumb: Project → Tree with nav back to project trees list
- [ ] ITEM-086: Multiple tree types per project — project can have skill tree, kanban, gantt as separate views

## Phase 19: Agent Status Realtime
- [ ] ITEM-094: Single agent swimlane — default to one swimlane "Coding Agent"; architecture supports multiple lanes
- [ ] ITEM-095: Timeline zoom + pan — scroll horizontally; zoom between day/week/month granularity
- [ ] ITEM-096: Current time indicator — vertical now line on timeline
- [ ] ITEM-092: Swimlane Gantt layout — horizontal swimlanes (one per agent); tickets as blocks on a timeline with start and end dates
- [ ] ITEM-093: Ticket duration from pm_tickets — use created_at as start, completed_at as end; render as coloured bar

## Phase 20: Dependency Flow + Gantt
- [ ] ITEM-097: Unified timeline component — single component with DAG mode (execution order) and Gantt mode (calendar dates); toggle between them
- [ ] ITEM-098: DAG layout engine — topological sort by depends_on edges; column 0 = no deps, arrows show blocking relationships
- [ ] ITEM-099: Gantt layout engine — map tickets to calendar X axis using created_at/completed_at
- [ ] ITEM-100: Swimlane renderer — one row per agent; tickets as coloured bars; dependency arrows overlay both modes
- [ ] ITEM-101: Ticket status colours — locked=grey, in_progress=amber pulse, completed=green, blocked=red
- [ ] ITEM-102: Blocked path highlight — click ticket to highlight full upstream + downstream chain in both modes
- [ ] ITEM-103: Current time indicator (Gantt mode) — vertical now line on calendar axis
- [ ] ITEM-104: Add unified timeline to view switcher — single Timeline button with DAG/Gantt sub-toggle
- [ ] ITEM-106: Dependency-aware queue — sf_get_pending_items() should check depends_on edges before picking next item; skip nodes whose dependencies aren't all completed yet; try next candidate in priority order

## Phase 21: View Consolidation
- [x] ITEM-107: Merge Tree + WorldMap views — keep SkillTreeView2D as the base; add a style toggle (clean vs RPG fog-of-war); remove WorldMapView component and worldmap mode from ViewSwitcher and store
- [x] ITEM-108: Merge Weight + Memory views — keep WeightGraphView as the base; add a mode toggle (weight mode = edge-weight pull vs associative mode = edge-type pull); remove MemoryMapView component and memory mode
- [x] ITEM-109: Update ViewSwitcher UI — consolidate to 5 buttons: Solar / Skill Tree / Graph / Kanban / Timeline; remove duplicate buttons; persist selected view to localStorage
- [x] ITEM-110: Clean up ViewMode type — remove worldmap and memory from ViewMode union in tree-store.ts; update all references

## Phase 22: Event-Driven PM Architecture
- [ ] ITEM-111: Simplify pm_cycle.py — queue manager only: check if any node is in_progress, if none pick highest priority locked node and set in_progress; remove all agent spawning logic
- [ ] ITEM-112: OpenClaw webhook endpoint for coding agent — register a webhook trigger so PM can POST to it to start a coding agent session; coding agent task comes from the in_progress node in Supabase
- [ ] ITEM-113: PM posts webhook call on ticket activation — when PM sets a node to in_progress, POST to the coding agent webhook endpoint with ticket details
- [ ] ITEM-114: PM re-triggers webhook on stale heartbeat — if in_progress node heartbeat is stale (>35min), PM re-POSTs to coding agent webhook to restart it; posts ⚠️ to Telegram
- [ ] ITEM-115: PM posts Telegram summary on every action — on ticket activation, re-trigger, or all-done, post a clear summary message to the group via PM bot
- [ ] ITEM-116: Coding agent reads ticket from Supabase — on webhook trigger, coding agent reads ticket details (brief, item_id) from skill_nodes properties/content instead of receiving them in the spawn payload
- [ ] ITEM-117: Error reporting — coding agent wraps implementation in try/except, posts ❌ error message to Telegram on failure; PM posts ⚠️ if webhook fails; after 3 re-triggers post 🚨 stuck alert and stop retrying
