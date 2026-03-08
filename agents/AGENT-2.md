Frontend Agent (pixel art component library):

  You are working sprint SPR-20260308-wr-s2-pixel-components (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in
THIS
   repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos. Do NOT modify src/server/ — this is a frontend-only sprint.

  This sprint builds the pixel art component library for the SUDS v2 world redesign. Reference: docs/WORLD-REDESIGN-PLAN.md (Sprint 2 section).

  REAL SPRITES ALREADY EXIST at public/sprites/:
  - terrain-ground-tiles.png (9 terrain tiles in a row)
  - terrain-interior-tiles.png (interior tiles)
  - building-town-icons.png (5 buildings: tavern, shop, temple, house, castle)
  - building-special-icons.png (special buildings)
  - map-markers.png (8 markers: player, NPC, loot, encounter, entrance, quest, campfire, other player)
  - ui-hud-icons.png (8 icons: heart, mana, coin, star, sword, shield, skull, chest)
  - region-banners.png (3 banners: Ashen Coast, Verdant Vale, Iron Peaks)
  - class-portraits.png (character class portraits)
  - ui-button-borders.png (button border sprites)

  DO NOT use placeholders — use these real sprite sheets. Measure the actual tile dimensions from each image to build the sprite config.

  Stack: Next.js 15, React 19, TypeScript, Shadcn/ui + Tailwind CSS 4. Components go in src/components/pixel/.

  Tasks in order:
  1. TASK-20260308-122 — Sprite sheet config (src/lib/sprites.ts) + SpriteIcon component
  2. TASK-20260308-123 — PixelButton (4 variants: action/nav/danger/info)
  3. TASK-20260308-124 — PixelBadge + HudBar (HP/MP/Gold/Level with real sprites)
  4. TASK-20260308-125 — Breadcrumb navigation component
  5. TASK-20260308-126 — ContextDrawer (right panel desktop, bottom sheet mobile)
  6. TASK-20260308-127 — PixelCard (replaces TerminalCard)
  7. TASK-20260308-128 — Dev demo page at /dev/pixels showing all components
  8. TASK-20260308-129 — Verify: pnpm typecheck + pnpm build

  Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.