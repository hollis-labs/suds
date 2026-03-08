Backend Agent (schema + world seed):

  You are working sprint SPR-20260308-wr-s1-schema-foundation (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in
  THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint adds the layered world hierarchy schema (World > Region > Area > Building > Room) to the existing SUDS v2 game. Reference the full design:
  docs/WORLD-REDESIGN-PLAN.md (Sprint 1 section).

  Stack: Next.js 15, Drizzle ORM + PostgreSQL, tRPC, TypeScript. Schema lives in src/server/db/schema.ts. Game engine in src/server/game/.

  Tasks in order:
  1. TASK-20260308-114 — Create worlds table
  2. TASK-20260308-115 — Create regions table (FK → worlds)
  3. TASK-20260308-116 — Create areas table (FK → regions)
  4. TASK-20260308-117 — Create buildings table (FK → areas)
  5. TASK-20260308-118 — Add hierarchy columns to existing rooms table (nullable FKs)
  6. TASK-20260308-119 — Create fog_of_war table + add worldId to characters
  7. TASK-20260308-120 — Build world seed script (1 world, 3 regions matching region-banners.png: Ashen Coast, Verdant Vale, Iron Peaks)
  8. TASK-20260308-121 — Verify end-to-end: pnpm db:push + pnpm typecheck

  CRITICAL: All new columns on existing tables MUST be nullable for backward compatibility. The existing game must continue working unchanged after schema
  changes.

  Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm db:push` after schema changes and `pnpm typecheck` after code changes.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.