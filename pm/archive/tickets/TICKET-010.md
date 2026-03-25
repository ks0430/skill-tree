# TICKET-010: Suggested follow

**Status:** done
**Roadmap item:** ITEM-010
**Created:** 2026-03-24T04:20:02Z
**Completed:** 2026-03-24T04:28:00Z
**Commit:** f00b65bc1b4fcf83ff7b589be1f41537a0450af0

## Brief
up prompts — after AI responds, show 2-3 contextual follow-up suggestions below the reply

## Acceptance Criteria
- [x] Implementation matches the description above
- [x] Code is clean and consistent with the existing codebase
- [x] No regressions introduced

## Git Diff Summary
- `src/app/api/chat/route.ts` — After saving the assistant message, makes a fast claude-haiku call to generate 2-3 contextual follow-up suggestions, emitted as a new `suggestions` SSE event
- `src/types/chat.ts` — Added `suggestions` type to SSEEvent
- `src/lib/store/chat-store.ts` — Added `suggestions` state, `setSuggestions`, and `clearSuggestions` actions
- `src/components/chat/ChatPanel.tsx` — Handles `suggestions` SSE event, clears on new user message, renders follow-up suggestion pill buttons below messages; renamed local `suggestions` array to `starterPrompts` to avoid conflict

## Summary
After each AI response, the API generates 2-3 short contextual follow-up suggestions using claude-haiku. These appear as clickable pill buttons below the conversation. Clicking a suggestion sends it as the next message and clears the suggestions.
