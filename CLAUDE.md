# SUDS v2 - Single User Dungeon(s)

## What this is

A web-based dungeon crawler with retro terminal aesthetics. React frontend, Next.js fullstack, PostgreSQL backend.

## Key constraint

**The client is pure UI/UX.** All game logic, state mutations, and content generation runs server-side in `src/server/game/`. The React layer renders state and emits user actions. No game math in components.

## Architecture

- `src/app/` - Next.js App Router pages
- `src/components/ui/` - Shadcn base components
- `src/components/terminal/` - Terminal-themed UI components
- `src/components/game/` - Game-specific components
- `src/server/game/` - Game engine (ALL game logic here)
- `src/server/db/` - Drizzle ORM schema and migrations
- `src/server/trpc/` - tRPC API routers
- `src/stores/` - Zustand client state
- `src/hooks/` - React hooks
- `src/lib/` - Utilities and constants
- `docs/` - PRD, SPEC, PLAN

## Stack

- Next.js 15 (App Router), React 19, TypeScript
- Shadcn/ui + Tailwind CSS 4
- tRPC for API, Zustand for client state
- NextAuth.js v5 (social login)
- Drizzle ORM + PostgreSQL
- Anthropic Claude API for content generation

## Patterns

- Props push down, events bubble up. No deep global state access.
- Reusable components in `components/ui/` and `components/terminal/`
- Game logic ONLY in `src/server/game/` - never in components or API routes
- tRPC routers are thin - they call game engine functions and return results
- All user inputs validated server-side
- Content safety filtering on all AI-generated content

## Development

```bash
pnpm dev          # Start dev server
pnpm db:push      # Push schema changes
pnpm db:migrate   # Run migrations
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check
```
