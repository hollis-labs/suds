Backend Agent (world generation pipeline):

  You are working sprint SPR-20260308-world-redesign-s4-worldgen (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in
  THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos. Do NOT modify src/components/ — this is a backend-only sprint.

  This sprint builds the world generation pipeline — AI-powered generators for regions, areas, and buildings that populate the world hierarchy tables created in Sprint 1. Reference: docs/WORLD-REDESIGN-PLAN.md (Sprint 4 section).

  ## What Already Exists (Sprint 1 output — DO NOT recreate)

  Schema tables already exist in `src/server/db/schema.ts`:
  - `worlds` — id, name, description, theme, seed, createdAt
  - `regions` — id, worldId (FK), name, description, theme, position (jsonb), connections (text[]), metadata (jsonb), generatedBy, createdAt
  - `areas` — id, regionId (FK), name, description, areaType, gridWidth, gridHeight, position (jsonb), connections (text[]), metadata (jsonb), generatedBy, createdAt
  - `buildings` — id, areaId (FK), name, description, buildingType, floors, gridWidth, gridHeight, position (jsonb), metadata (jsonb), generatedBy, createdAt
  - `fogOfWar` — id, characterId (FK), entityType, entityId, discoveredAt (unique on characterId+entityType+entityId)
  - `rooms` table has nullable hierarchy columns: worldId, regionId, areaId, buildingId, floor
  - `characters` has nullable worldId

  Existing content library: `src/server/game/content-library.ts`
  - `storeContent(db, type, theme, tags, content)` — saves to content_library table
  - `selectOrGenerate(db, options)` — checks library first, generates if needed
  - ContentType currently supports: "room_description" | "npc_dialogue" | "lore_fragment" | "quest"
  - You'll need to ADD new content types: "region", "area", "building", "floor_layout"

  Existing world generation: `src/server/game/world.ts` — room generation (generateRoom, pickRoomType, generateExits, etc.)
  Existing AI integration: `src/server/game/templates.ts` — generateTemplateContent() calls Claude API
  Existing AI usage tracking: `aiUsage` table in schema, tracked in templates.ts
  Existing themes: `src/server/gamedata/themes.json` — flavor text per theme (horror, funny, epic, dark_fantasy)
  Existing world seed: `src/server/game/world-seed.ts` — seedStarterWorld() creates initial world/regions/areas/buildings

  Stack: Next.js 15, Drizzle ORM + PostgreSQL, tRPC, TypeScript. Game engine in src/server/game/. Admin panel in src/components/admin/.

  ## Tasks in order:

  1. TASK-20260308-077 — Build region generator
     Create `src/server/game/world-gen/region.ts`:
     - `generateRegion(worldId, theme, position, options?)` → returns data insertable into regions table
     - Use selectOrGenerate pattern from content-library.ts (check cache first, AI generate if needed)
     - AI generates: region name, description (2-3 sentences lore), landmarks (3-5 named locations), faction name, biome
     - Save generated content to content_library with type "region"
     - Track AI usage via aiUsage table
     - Content must match theme tone (reference themes.json)

  2. TASK-20260308-078 — Build area generator
     Create `src/server/game/world-gen/area.ts`:
     - `generateArea(regionId, areaType, position, theme)` → returns area data + building position list
     - AreaType determines strategy:
       - town: 15x15 grid, 3-5 buildings (tavern, shop, temple, houses), road tiles connecting them
       - wilderness: 20x20 grid, scattered terrain features, 1-2 POIs (ruins, cave, shrine)
       - ruins: 15x15, mix of structures + open ground, higher encounter density
       - fortress: 15x15, walls, gates, courtyard, multiple buildings
       - dungeon_entrance: 10x10, small area around dungeon entrance
     - Returns building positions: [{x, y, buildingType, suggestedName}]
     - Use content library caching + AI usage tracking

  3. TASK-20260308-079 — Build building generator
     Create `src/server/game/world-gen/building.ts`:
     - `generateBuilding(areaId, buildingType, position, theme, options?)` → building data + floor layout templates
     - Building types:
       - tavern: 1 floor, common room with tables/bar/fireplace (safe room)
       - shop: 1 floor, storefront with shelves/counter, links to store system
       - temple: 1-2 floors, main hall with altar/shrine
       - house: 1 floor, 2-3 rooms, may contain NPC or loot
       - castle: 2-3 floors, grand halls, throne room, armory, dungeon below
       - dungeon: 3-10 floors, uses existing generateRoom() with hierarchy fields populated
     - Floor layout: { floor, width, height, rooms: [{x, y, roomType, name?, features?}] }
     - For dungeons: reuse generateRoom() from world.ts but populate worldId/regionId/areaId/buildingId/floor
     - Use content library caching

  4. TASK-20260308-080 — Wire generators to content library with template support
     Enhance `src/server/game/content-library.ts`:
     - Add new content types: "region", "area", "building", "floor_layout"
     - Template promotion: content with quality >= 4 flagged as template (add to tags)
     - Template-first lookup: check templates (quality >= 4) → same-theme content → generate new
     - Add `promoteToTemplate(contentId)` function for admin use
     - Track reuse: increment usageCount and lastUsedAt on reuse
     - Add index on content_library(type, theme) if not present
     - Backward compatible with existing usage

  5. TASK-20260308-081 — Admin: World hierarchy browser
     Extend admin panel (add to existing AdminWorldData.tsx or new tab):
     - Tree navigation: World → Regions → Areas → Buildings (expandable/collapsible)
     - Detail panel: name, description, theme, generatedBy, metadata (formatted), child counts
     - Stats bar: total worlds, regions, areas, buildings, rooms
     - New tRPC endpoints in admin router:
       - admin.getWorldHierarchy — worlds with nested counts
       - admin.getRegionDetail — region + its areas
       - admin.getAreaDetail — area + its buildings
       - admin.getBuildingDetail — building + floor info

  6. TASK-20260308-082 — Admin: Content template manager
     New admin sub-section:
     - Template list: content_library entries with quality >= 4, filterable by type and theme
     - Show: content preview, quality rating, usage count, last used
     - Actions: promote to template (quality=5, add "template" tag), edit content, adjust quality (+/-)
     - New tRPC endpoints: admin.getTemplates, admin.promoteTemplate, admin.updateTemplate, admin.getTemplateStats

  7. TASK-20260308-083 — Generation cost dashboard
     Extend admin AI usage section:
     - Cost breakdown by generation type (region, area, building, room, NPC, lore, quest)
     - Template reuse rate: total requests, cache hits/misses, estimated tokens saved
     - Time series: daily/weekly token usage (table format is fine, no chart library needed)
     - Per-world stats: tokens spent per world
     - Data source: existing aiUsage table, add new feature values for world gen types

  ## Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after code changes.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.
  - All game logic goes in `src/server/game/` — never in components or API routes.
  - tRPC routers should be thin wrappers calling game engine functions.
  - Generators return data — they do NOT commit to DB. The caller handles DB inserts.
  - Use the existing selectOrGenerate pattern for content caching, not a new approach.
  - Track AI usage via the existing aiUsage table and tracking pattern in templates.ts.
