# TICKET-009: AI context: include current tree nodes in chat prompt

**Status:** done
**Roadmap item:** ITEM-009
**Created:** 2026-03-24T04:00:03Z
**Completed:** 2026-03-24
**Commit:** 35af7723f6933467f73a452f13888e01ba55c09b

## Brief
send existing nodes to Claude so it can reference what already exists

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
`src/lib/ai/prompt.ts`: added `descriptionSuffix()` helper that appends a node's `description` field to its line in the system prompt tree view. Applied to stellar, planet, and satellite entries so Claude sees each node's description alongside its id, label, status, priority, and checklist.

## Summary
The `/api/chat` route already fetched all tree nodes and passed them to `buildSystemPrompt`. The system prompt was missing node descriptions — added `descriptionSuffix()` to include each node's `description` field in the hierarchical tree view sent to Claude, giving it full context about every existing node before responding.
