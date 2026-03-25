# TICKET-035: Single root node

**Status:** done
**Roadmap item:** ITEM-056
**Created:** 2026-03-25T01:00:27Z
**Completed:** 2026-03-25
**Commit:** d58a59c

## Brief
add a virtual ROOT node all phase stellars connect to, so the tree flows from one origin point upward

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

**`src/components/canvas/SkillTreeView2D.tsx`** — added `VIRTUAL_ROOT_ID` constant and updated `buildDagreLayout` to inject a zero-size virtual ROOT node into the dagre graph, then connect all stellar nodes (those with `type === "stellar"` and no parent / no incoming dep-edge) to it via synthetic edges. ROOT node and its edges are excluded from the rendered output so only real nodes and real edges are drawn.

## Summary

Added a virtual ROOT node to the 2D tree layout in `SkillTreeView2D.tsx`. Previously each stellar node was an independent root in the dagre graph, causing multiple disconnected tree tops. Now a hidden `__ROOT__` node sits above all stellars — dagre treats it as the single origin and arranges all stellars as its children, giving the tree one unified flow from the top downward. The ROOT node is injected with zero dimensions and its edges are filtered out before rendering, so the visual output is unchanged except all stellars now align under a single hierarchical root.
