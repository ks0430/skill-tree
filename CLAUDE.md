# SkillForge — AI-Powered Galaxy Skill Tree Builder

## Tech Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Supabase (auth + PostgreSQL)
- React Three Fiber + drei (3D visualization)
- Zustand (state management)
- Tailwind CSS v3 + Framer Motion
- Claude API (@anthropic-ai/sdk) with tool use + SSE streaming

## Architecture
- **Solar system metaphor**: Stellars = stars (main topics), Planets = skills (orbit stars), Satellites = sub-skills (orbit planets)
- No edges — hierarchy is defined by `parent_id` + `role` on each node
- 3D positions are computed by `layoutGalaxy()` in `src/lib/store/tree-store.ts`, not stored in DB
- Procedural planet textures generated in `src/components/canvas/planets.ts` (canvas 2D noise)
- AI proposes changes via tool calls → rendered as PendingChange cards → user accepts/rejects → persisted to Supabase

## Key Files
- `src/lib/ai/prompt.ts` — Claude system prompt (galaxy rules)
- `src/lib/ai/tools.ts` — Claude tool schemas (add_node, remove_node, update_node, bulk_modify)
- `src/lib/store/tree-store.ts` — Zustand store + orbital layout engine
- `src/components/canvas/SkillNode3D.tsx` — Planet renderer with orbital animation
- `src/components/canvas/planets.ts` — Procedural texture generator
- `src/app/api/chat/route.ts` — Claude streaming SSE endpoint

## Database
- Tables: `skill_trees`, `skill_nodes`, `skill_edges` (unused), `chat_messages`
- `skill_nodes` has: `role` (stellar/planet/satellite), `parent_id`, `status`, `priority`
- RLS on all tables, scoped to `auth.uid()`

## Workflow
- **Always commit after making changes.** Every completed task/feature/fix should end with a git commit before moving on.
- **Do NOT run `next build` to validate.** The user will test manually via `npm run dev`. Just commit and move on.

## Conventions
- Node.js 18 environment — no Tailwind v4, no packages requiring Node 20+
- `frameloop="always"` for Three.js canvas (planets animate continuously)
- Shared geometries in `sharedGeo` to avoid per-node GPU allocations
- Status shown via brightness (dim→medium→bright), not color coding
- Supabase composite PK on skill_nodes: `(id, tree_id)`

## Dev
```
npm run dev     # start dev server
npm run build   # production build
```
Env vars needed in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
