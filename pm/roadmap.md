# Roadmap: SkillForge

## Summary
SkillForge is an AI-powered 3D skill tree builder using a solar system metaphor (Stellars = stars, Planets = skills, Satellites = sub-skills). Users describe what they want to learn, Claude proposes nodes via tool calls, and the tree renders in a live 3D canvas. Built with Next.js 15, React Three Fiber, Supabase, and the Claude API.

## Phase 1: Core UX Polish
- [x] ITEM-001: Loading state for dashboard — add skeleton loader while skill trees are fetching from Supabase
- [x] ITEM-002: Empty state for dashboard — show a prompt/CTA when user has no trees yet
- [x] ITEM-003: Tree rename — allow user to rename a skill tree from the dashboard
- [x] ITEM-004: Tree delete — add delete button with confirmation dialog on dashboard
- [x] ITEM-005: Toast notifications — add a lightweight toast system for success/error feedback (create, delete, save)
- [x] ITEM-006: Node description visible in detail panel — display node description text in NodeDetailPanel below the title

## Phase 2: AI Improvements
- [x] ITEM-007: acceptAll fix for update_node — acceptAll in ChatPanel only handles add_node; wire up update_node and remove_node cases
- [x] ITEM-008: Persist chat messages to Supabase — currently chat history is in-memory only; save/load from chat_messages table
- [x] ITEM-009: AI context: include current tree nodes in chat prompt — send existing nodes to Claude so it can reference what already exists
- [ ] ITEM-010: Suggested follow-up prompts — after AI responds, show 2-3 contextual follow-up suggestions below the reply

## Phase 3: Node Interactions
- [ ] ITEM-011: Node status click in 3D canvas — clicking a node cycles its status (locked → in_progress → completed) and persists to Supabase
- [ ] ITEM-012: Node progress indicator on planet — show a small visual ring or glow on planets that reflects their checklist completion %
- [ ] ITEM-013: Search result highlight — when search finds a node, briefly highlight/pulse it in the canvas (currently just flies camera to it)
- [ ] ITEM-014: Pinned node panel persists on refresh — restore pinnedNodeId from localStorage on load

## Phase 4: Tree Management
- [ ] ITEM-015: Duplicate tree — add "duplicate" option on dashboard to clone a tree with all its nodes
- [ ] ITEM-016: Export tree as JSON — download the full tree (nodes + metadata) as a JSON file
- [ ] ITEM-017: Share tree (read-only link) — generate a public share URL that renders the tree in read-only mode
- [ ] ITEM-018: Tree thumbnail on dashboard — generate/store a static thumbnail preview for each tree card

## Phase 5: Performance & Quality
- [ ] ITEM-019: Memoize SkillNode3D render — wrap in React.memo to prevent unnecessary re-renders when unrelated store state changes
- [ ] ITEM-020: Debounce Supabase writes in NodeDetailPanel — checklist toggle fires a DB write per click; debounce to 500ms
- [ ] ITEM-021: Error boundary for 3D canvas — wrap SkillTreeCanvas in an ErrorBoundary with a fallback UI
- [ ] ITEM-022: Mobile layout — basic responsive layout for the tree page on narrow screens (collapse panels, show canvas full-width)
