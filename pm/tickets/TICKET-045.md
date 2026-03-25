# TICKET-045: Related/references edge creation UI

**Status:** done
**Roadmap item:** ITEM-047
**Created:** 2026-03-25T06:00:37Z
**Completed:** 2026-03-25
**Commit:** c99b27f

## Brief
quick-link two nodes from detail panel

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary

- `src/components/panel/PanelRelations.tsx` — new component: collapsible "Relations" section with node search, edge-type selector (related/references/depends_on/blocks), link button, and a list of existing edges with remove (✕) per row
- `src/components/panel/NodeDetailPanel.tsx` — import and render `<PanelRelations>` below the checklist (write mode only)

## Summary

Added a `PanelRelations` component that renders inside the node detail panel whenever the panel is not in read-only mode. It lets users:

1. **View** all existing non-parent edges connected to the current node, showing direction (→ source / ← target), type colour dot, the other node's label, and a remove button.
2. **Create** a new edge by typing a search query to find another node (live-filtered, excluding already-linked nodes and self), selecting a node from the dropdown, choosing one of four edge types (related, references, depends_on, blocks), and clicking "+ Link node".

The component reads from and writes to the existing `addEdge` / `removeEdge` store actions, which already handle optimistic updates and Supabase persistence. No schema or API changes were needed. The section collapses by default (▼/▲ toggle) and shows a count badge when there are existing relations.
