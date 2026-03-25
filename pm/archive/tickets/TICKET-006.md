# TICKET-006: Node description visible in detail panel

**Status:** done
**Roadmap item:** ITEM-006
**Created:** 2026-03-24T02:30:04Z
**Completed:** 2026-03-24
**Commit:** f6b48c62c7447009b3208bb5c7e0615d1173394b

## Brief
display node description text in NodeDetailPanel below the title

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Summary

NodeDetailPanel refactored into `src/components/panel/` with description rendered below the title using `node.data.description` when present.

## Git Diff Summary

- Deleted `src/components/canvas/NodeDetailPanel.tsx`
- Created `src/components/panel/NodeDetailPanel.tsx` with description paragraph rendered below the header
- Added `PanelHeader`, `PanelStatus`, `PanelChecklist` sub-components
- Added node content/checklist infrastructure (`node-content.ts`, checklist lib, AI checklist endpoint)
