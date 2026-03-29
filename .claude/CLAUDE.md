# SkillForge — Project Rules

## Git Workflow

- Never commit directly to `master`.
- For every change: create a new branch, commit, push, create a PR, and merge it.
- After merging, always return the PR URL to the user.
- This ensures all changes are tracked via PR history.

## Project Overview

- AI-powered galaxy skill tree builder with 3D visualization.
- Next.js 15 (App Router) + React 19 + TypeScript.
- Supabase for auth + PostgreSQL database.
- React Three Fiber for 3D rendering, Zustand for state management.
- Claude API with tool use + SSE streaming for AI features.
- Entry point: `npm run dev`

## Architecture

- **Solar system metaphor**: Stellars = stars, Planets = skills, Satellites = sub-skills.
- Hierarchy via `parent_id` + `role` — no edges.
- 3D layout computed at runtime by `layoutGalaxy()`, not stored in DB.
- AI proposes changes via tool calls → PendingChange cards → user accepts/rejects → persisted.

## Key Paths

- `src/lib/ai/` — Claude prompts, tools, streaming
- `src/lib/store/tree-store.ts` — Zustand store + orbital layout
- `src/components/canvas/` — 3D rendering (planets, skill nodes)
- `src/app/api/chat/route.ts` — Claude streaming SSE endpoint

## Conventions

- Node.js 18 — no packages requiring Node 20+.
- Tailwind CSS v3 (not v4).
- `frameloop="always"` for Three.js canvas.
- Do NOT run `next build` to validate — user tests via `npm run dev`.
- After code changes are committed and merged, **restart the dev server** by running: `pkill -f 'next-server' 2>/dev/null; sleep 2; cd /home/ubuntu/code/skillforge && npm run dev &`

## Database

- Tables: `skill_trees`, `skill_nodes`, `skill_edges` (unused), `chat_messages`
- RLS on all tables, scoped to `auth.uid()`
- Composite PK on skill_nodes: `(id, tree_id)`
- Valid statuses: `backlog`, `queued`, `in_progress`, `completed`

## Ticket Management

Tickets are stored in the `skill_nodes` table in Supabase — NOT in GitHub issues.
**NEVER use `gh issue create` or GitHub issues for tickets.**

When MCP tools are available, use them to manage tickets:
- `skillforge_list_phases()` — list phases to find the right parent_id
- `skillforge_create_ticket(...)` — create ticket (always use status "backlog")
- `skillforge_list_tickets(status)` — list tickets by status
- `skillforge_get_ticket(ticket_id)` — get ticket details
- `skillforge_update_ticket(ticket_id, ...)` — update ticket fields

Ticket flow: `backlog` → `queued` → `in_progress` → `completed`
- New tickets start in `backlog`
- User promotes to `queued` when ready for the coding agent
- Coding agent picks from `queued` only
- Ticket IDs (ITEM-NNN) are auto-generated

## Environment

Env vars in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
