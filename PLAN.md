# SkillForge — Full Product Plan

## Vision

A generic 3D knowledge and project graph. Same data, multiple views — each one optimised for a different mental model: game skill tree, project timeline, knowledge web, associative memory. The solar system is the first view, not the only one.

---

## Data Model (Target)

### Node
```
id, tree_id, label, description
type: string              ← user-defined ("skill", "task", "concept", "milestone", "note")
status: "locked" | "in_progress" | "completed"
priority: number
icon: string | null
properties: jsonb         ← structured metadata (due_date, assignee, estimate, difficulty...)
content: blocks[]         ← freeform body (checklists, notes, links)
```

### Edge
```
id, tree_id
source_id → target_id
type: "parent" | "depends_on" | "blocks" | "related" | "references"
weight: float             ← connection strength (for force-directed layout)
label: string | null
```

**Key shift from current model:**
- Drop hardcoded `role: stellar | planet | satellite` → replaced by `type` (user-defined) + edge `type: "parent"`
- Edges become first-class — activate the existing `SkillEdge` table, add `type` + `weight`
- A node can have multiple parents (prerequisites) — no longer strict single-parent tree
- `properties` unlocks Gantt dates, assignees, estimates without schema changes per feature

---

## Views

All views share the same data. A view is just a layout algorithm + camera preset + renderer.

### 1. Solar System (existing)
- **What:** Hierarchy as orbits. Stellars = stars, planets orbit stellars, satellites orbit planets.
- **Edges used:** `parent` only
- **Camera:** Free 3D orbit
- **Best for:** Exploring a large knowledge space, high-level overview
- **Status:** Built ✅

### 2. Skill Tree (priority 1)
- **What:** Top-down flat graph. Nodes are diamonds/circles with icons and glow. Prerequisite paths light up. Locked nodes are dark, unlocked nodes glow.
- **Edges used:** `parent` + `depends_on` (prerequisites)
- **Camera:** Orthographic top-down, locked rotation, pan + zoom only
- **Layout:** Layered/hierarchical auto-layout (dagre.js)
- **Inspired by:** Dragon Age: The Veilguard, Path of Exile passive tree
- **Best for:** Learning paths, skill progression, RPG-style unlocks
- **Status:** Not started

### 3. 3D Gantt (priority 2)
- **What:** Time axis runs horizontally (X). Dependency arrows show what blocks what. Nodes float at their start date, sized by estimate. Camera locked to front view — looks 2D but lives in 3D.
- **Edges used:** `depends_on` + `blocks`
- **Camera:** Orthographic front view, locked rotation, pan + zoom only
- **Properties needed:** `due_date`, `start_date`, `estimate` (on node properties jsonb)
- **Best for:** Product roadmaps, project tracking, sprint planning
- **Status:** Not started

### 4. Weight Graph (force-directed)
- **What:** Physics simulation. Nodes repel by default, edges pull connected nodes together. Heavily connected nodes cluster naturally. Edge thickness = weight.
- **Edges used:** All edge types + weight
- **Camera:** Free 3D orbit
- **Layout:** Force-directed simulation (three-forcegraph or custom spring physics)
- **Best for:** Seeing hidden patterns, finding densely connected concepts, knowledge mapping
- **Status:** Not started

### 5. Memory Map (associative)
- **What:** Similar to force-directed but with semantic drift — `related` and `references` edges pull softly, `parent` edges pull strongly. Concepts cluster by association, not hierarchy. Resembles how Obsidian's graph view works.
- **Edges used:** `related` + `references` (soft pull) + `parent` (strong pull)
- **Camera:** Free 3D orbit, slight auto-rotation for ambient life
- **Best for:** Personal knowledge bases, research notes, learning connections between ideas
- **Status:** Not started

---

## Architecture

```
SkillNode (Supabase)
    ↓
useTreeStore (Zustand)
    ↓
layoutEngine(view, nodes, edges) → Node3D[]
    ↓
<Renderer view={activeView} />
    ├── <SolarSystemRenderer />   (existing)
    ├── <SkillTreeRenderer />     (dagre layout + ortho camera)
    ├── <GanttRenderer />         (time axis layout + ortho camera)
    ├── <WeightGraphRenderer />   (force-directed + free camera)
    └── <MemoryMapRenderer />     (associative force + free camera)
```

View switching = swap renderer + trigger re-layout. Data store unchanged.

---

## Build Phases

### Phase 5: Schema + Edge Foundation
*Prerequisite for all new views*

- [ ] ITEM-023: Add `type` column to nodes — migrate `role` → `type`, keep backward compat
- [ ] ITEM-024: Add `type` + `weight` columns to edges table in Supabase
- [ ] ITEM-025: Edge CRUD in tree store — add/remove/update edges via Zustand + Supabase
- [ ] ITEM-026: Add `properties: jsonb` to nodes — Supabase migration + type update
- [ ] ITEM-027: Wire edges to AI tools — Claude can now create `depends_on` / `related` edges

### Phase 6: Skill Tree View
*Priority 1 — the game UI*

- [ ] ITEM-028: Install dagre.js + build skill tree layout engine
- [ ] ITEM-029: Orthographic top-down camera preset with pan/zoom controls
- [ ] ITEM-030: Diamond + circle node renderer with icon support
- [ ] ITEM-031: Glow shader on node status — locked=dark, in_progress=amber pulse, completed=green glow
- [ ] ITEM-032: Edge renderer — glowing lines between nodes, highlight prerequisite path on hover
- [ ] ITEM-033: Unlock animation — locked → in_progress transition with particle burst
- [ ] ITEM-034: View switcher UI — toggle between Solar System / Skill Tree (foundation for all views)

### Phase 7: 3D Gantt View
*Priority 2 — project tracking*

- [ ] ITEM-035: Date properties UI — add due_date / start_date / estimate fields to NodeDetailPanel
- [ ] ITEM-036: Gantt layout engine — map nodes to time axis positions
- [ ] ITEM-037: Orthographic front camera preset for Gantt
- [ ] ITEM-038: Dependency arrow renderer — `depends_on` / `blocks` edges as arrows
- [ ] ITEM-039: Today marker — vertical line at current date in Gantt view
- [ ] ITEM-040: Add Gantt to view switcher

### Phase 8: Weight Graph View
*Knowledge clustering*

- [ ] ITEM-041: Force-directed layout engine (spring physics, repulsion)
- [ ] ITEM-042: Edge weight visualisation — line thickness + opacity by weight
- [ ] ITEM-043: Node size by connection count (degree)
- [ ] ITEM-044: Add Weight Graph to view switcher

### Phase 9: Memory Map View
*Associative knowledge*

- [ ] ITEM-045: Memory map layout — tiered force with edge-type-weighted pull strengths
- [ ] ITEM-046: Ambient camera drift — slow auto-rotation when idle
- [ ] ITEM-047: Related/references edge creation UI — quick-link two nodes from detail panel
- [ ] ITEM-048: Add Memory Map to view switcher

---

## Open Questions

1. **Node type system** — fully free-form strings, or a set of predefined types per workspace? Free-form is more flexible but harder to render consistently.
2. **Edge creation UX** — how does a user draw an edge in the canvas? Drag from node to node? Button in detail panel?
3. **Skill tree unlock logic** — is unlocking automatic (all prerequisites done → auto-unlock)? Or always manual?
4. **Gantt data source** — for product dev use case, should nodes be importable from GitHub Issues / Linear tickets?
5. **Multiplayer** — shared trees with real-time presence? Supabase Realtime could handle this, but it's a significant scope addition.

---

*Last updated: 2026-03-24*
