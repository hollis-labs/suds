Fullstack Agent (navigation integration):

  You are working sprint SPR-20260308-world-redesign-s5-navigation (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in
  THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint wires the S3 tile map renderer (frontend) to the S4 world generation pipeline (backend) via tRPC endpoints and a hierarchical position model. It adds world/region map views, integrates TileMap for area/building exploration, and connects the Breadcrumb + ContextDrawer into the game loop. Reference: docs/WORLD-REDESIGN-PLAN.md (Sprint 5 section).

  ## What Already Exists — DO NOT recreate any of these

  ### Schema (Sprint 1)
  - `worlds`, `regions`, `areas`, `buildings` tables in `src/server/db/schema.ts`
  - `fogOfWar` table (characterId, entityType, entityId, discoveredAt)
  - `rooms` table has nullable hierarchy columns: worldId, regionId, areaId, buildingId, floor
  - `characters` has nullable worldId

  ### Pixel Components (Sprint 2)
  - `src/components/pixel/SpriteIcon.tsx` — renders sprites from sheet
  - `src/components/pixel/PixelButton.tsx` — 4 variants (action/nav/danger/info)
  - `src/components/pixel/PixelCard.tsx` — styled container
  - `src/components/pixel/Breadcrumb.tsx` — hierarchical navigation breadcrumb
  - `src/components/pixel/ContextDrawer.tsx` — slide-in detail panel (right desktop, bottom mobile)
  - `src/components/pixel/HudBar.tsx` — HP/MP/Gold/Level display

  ### Tile Map (Sprint 3)
  - `src/lib/tile-types.ts` — TileData, TileMapData, TileMarker, TileVisibility types
    - `roomTypeToSpriteId(roomType)` — maps RoomType to terrain SpriteId
    - `roomFeaturesToMarkers(features, hasEncounter, hasLoot)` — extracts markers
    - `buildTileFromRoom(room, playerPos, discovered)` — converts Room to TileData
  - `src/components/pixel/TileMap.tsx` — CSS Grid tile renderer with:
    - Props: mapData, playerPosition, viewportWidth, viewportHeight, tileScale, onTileClick, onMove
    - Click-to-move (adjacent walkable tiles)
    - WASD/arrow keyboard movement
    - Fog of war (hidden/discovered/visible CSS classes)
    - Dead-zone viewport scrolling
  - `src/components/pixel/TileTooltip.tsx` — hover/long-press tile info

  ### World Gen (Sprint 4)
  - `src/server/game/world-gen/region.ts` — `generateRegion(worldId, theme, position, options?)`
  - `src/server/game/world-gen/area.ts` — `generateArea(regionId, areaType, position, theme)`
  - `src/server/game/world-gen/building.ts` — `generateBuilding(areaId, buildingType, position, theme, options?)`
  - All generators return data without committing to DB
  - `src/server/game/content-library.ts` — enhanced with template-first lookup, promoteToTemplate()

  ### Existing Game Architecture
  **Types** (`src/lib/types.ts`):
  - `Position`: `{ x: number; y: number }`
  - `Direction`: `"north" | "south" | "east" | "west"`
  - `Room`: id, x, y, name, type, description, exits, depth, hasEncounter, encounterData, hasLoot, lootData, visited, roomFeatures
  - `Player`: id, name, class, theme, level, xp, hp, mp, gold, stats, ac, position, equipment, abilities, lastSafe, etc.
  - `GameState.screen` union: "exploring" | "combat" | "store" | "npc" | "inventory" | "character" | "death" | "level_up" | "lore" | "party" | "news" | "about"

  **Game Store** (`src/stores/gameStore.ts`):
  - State: player, currentRoom, mapViewport, combatState, activeStore, activeNPC, gameLog, isLoading, screen
  - Simple setters: setPlayer, setCurrentRoom, setMapViewport, setCombatState, setActiveStore, setActiveNPC, setScreen, addToGameLog, setLoading, reset

  **Game Page** (`src/app/(game)/play/[characterId]/page.tsx`):
  - Left panel (35%): Map + DPad
  - Right panel (65%): Combat/Text/Actions based on screen
  - Uses tRPC mutations: move, combat.start, combat.action, etc.
  - `handleDPadMove(direction)` → calls moveMutation
  - `handleAction(action)` — main action dispatcher
  - `EXPLORING_KEY_MAP` — keyboard shortcuts for WASD, search, rest, interact, etc.
  - Renders MapPanel (ASCII) for current map — this gets replaced by TileMap for new-system characters

  **Game Router** (`src/server/trpc/routers/game.ts`):
  - Existing endpoints: move, getMap, searchRoom, interact, rest, shrine, visitBase, fastTravelBase
  - Auth pattern: `userId = ctx.session.user.id!` → `getOwnedCharacter(db, characterId, userId)`
  - Rooms keyed by (characterId, x, y), per-character generation
  - `buildPlayer(character, items)`, `buildRoom(row)`, `getRoomAt(db, charId, x, y)` helpers
  - Room generation: `generateRoom(characterId, x, y, theme, depth, entryDir, level)`

  **Current Map Component** (`src/components/game/Map.tsx`):
  - ASCII art terminal map using Unicode box-drawing characters
  - Takes `viewport: MapViewport` prop with cells grid
  - This stays for legacy characters (worldId === null)

  **Keyboard Hook** (`src/hooks/useKeyboard.ts`):
  - `useKeyboard(handlers: Record<string, () => void>, enabled?: boolean)`
  - Skips INPUT/TEXTAREA/contentEditable, ignores Ctrl/Alt combos
  - No changes needed — hook is generic

  ## Tasks in order:

  1. TASK-20260308-084 — Build world map view (pick-and-go region selection)
     Create `src/components/game/WorldMapView.tsx`:
     - Props: regions (array with id, name, description, theme, position, discovered), currentRegionId?, onSelectRegion
     - Dark background with stylized region nodes using PixelCard or large clickable nodes
     - Show region name, theme icon, discovered/undiscovered ("???" with dim appearance)
     - Current region highlighted with glow
     - Click discovered region → onSelectRegion callback
     - Connection lines between regions
     - Strategic "pick and go" — NO grid movement
     - Add "world_map" to GameState.screen union in types.ts

  2. TASK-20260308-085 — Build region map view (pick-and-go area selection)
     Create `src/components/game/RegionMapView.tsx`:
     - Props: regionName, areas (array with id, name, description, areaType, position, discovered), currentAreaId?, onSelectArea, onBack
     - Area nodes with icons based on areaType (town=building_tavern, wilderness=terrain_forest, ruins=building_ruins, etc.) using SpriteIcon
     - Area name labels, discovered/undiscovered treatment, current area highlighted
     - Connection paths between adjacent areas
     - Back button to return to world map
     - Strategic "pick and go" — NO grid movement
     - Add "region_map" to GameState.screen union in types.ts

  3. TASK-20260308-086 — Integrate TileMap for area grid exploration
     Wire TileMap into actual game loop:
     - In game page: when player is in an area (not world/region map), render TileMap instead of MapPanel
     - Convert room data from game.getMap response into TileMapData using buildTileFromRoom()
     - Wire onTileClick → game.move tRPC mutation (translate tile click to direction)
     - Wire onMove → game.move (for keyboard movement from TileMap)
     - Building entrance tiles: click triggers game.enterBuilding instead of game.move
     - Area edge: prompt "Travel to [adjacent area]?" or auto-transition
     - Add navigationLayer to game store: "world" | "region" | "area" | "building"
     - Keep old MapPanel for legacy characters (worldId === null)

  4. TASK-20260308-087 — Integrate TileMap for building/dungeon interior exploration
     Same TileMap but with interior tile sets:
     - When entering building, switch to building interior view
     - Render floor grid with interior sprites (wall, door, stairs, floor_wood, lava)
     - Stairs up/down tiles trigger game.changeFloor endpoint
     - Exit tile triggers game.exitBuilding → return to area grid
     - Room generation inside buildings uses generateRoom() with hierarchy fields
     - Track current floor in position
     - Fog of war per-floor (discovering floor 1 ≠ floor 2)
     - Dungeons: multi-floor with increasing depth, deeper = harder encounters
     - Floor transition: brief "Descending to Floor X..." message

  5. TASK-20260308-088 — Room detail view in ContextDrawer
     Show room details in ContextDrawer instead of full-screen takeover:
     - Trigger: click current tile, or enter interactive room (NPC, store, loot, shrine)
     - Drawer content: room name, description, type indicator, available action PixelButtons
     - Actions: Search, Rest, Talk, Shop, Pray, Pick Up — rendered as PixelButtons
     - Auto-open: interactive rooms (NPC/store/shrine) auto-open drawer on enter
     - Combat: encounters still trigger full-screen combat panel (NOT in drawer)
     - Map stays visible while drawer is open
     - Consolidates current full-screen patterns (store, NPC screens) into drawer

  6. TASK-20260308-089 — Integrate Breadcrumb navigation into game layout
     Wire Breadcrumb below the map:
     - Segments from position: World > Region > Area > Building > Floor
     - Derive from player's current HierarchicalPosition
     - Click parent segment → navigate up to that layer (call appropriate tRPC endpoint)
     - Combat check: confirm dialog before navigating away during combat
     - Back button (←) → one level up
     - Cache entity names in game store to avoid re-fetching

  7. TASK-20260308-090 — New tRPC endpoints for layer navigation
     Add to `src/server/trpc/routers/game.ts`:
     - game.getWorldMap (query): characterId → world + regions with fog_of_war applied
     - game.getRegionMap (query): characterId, regionId → region + areas with fog_of_war
     - game.travelToRegion (mutation): validate discovered/adjacent, update position, create fog_of_war entry
     - game.travelToArea (mutation): validate within region + discovered/adjacent, update position, create fog_of_war
     - game.enterBuilding (mutation): validate building at current tile, update position to floor 0
     - game.exitBuilding (mutation): return to area grid at entrance position
     - game.changeFloor (mutation): validate stairs, update floor, generate floor if unexplored
     - All mutations: validate character ownership, follow existing auth patterns

  8. TASK-20260308-091 — Update character position model for hierarchy
     Expand position from flat {x, y} to hierarchical:
     - Add HierarchicalPosition type to types.ts: { worldId, regionId, areaId, buildingId?, floor?, x, y }
     - Keep existing Position type for backward compat
     - Add isLegacyPosition(pos) type guard
     - Update game.move: if character has worldId → use hierarchy validation; if no worldId → existing flat logic
     - Update generateRoom() to accept and populate hierarchy fields when available
     - Update all position-reading code to handle both formats:
       - game.ts (move, getMap, searchRoom)
       - store.ts (store lookup)
       - combat.ts (respawn position)
       - gameStore.ts (client tracking)
     - CRITICAL: existing characters with {x, y} must continue working unchanged

  ## Key Integration Notes:

  - **Legacy compatibility**: Characters with `worldId === null` use the old MapPanel + flat {x,y} movement. Characters with worldId use TileMap + hierarchical navigation. Check `character.worldId` to determine which code path to use.
  - **Navigation layers**: world_map and region_map are "pick and go" (click to travel). area and building use TileMap grid exploration (the core gameplay).
  - **Screen state**: Add "world_map" and "region_map" to the screen union. Use navigationLayer in gameStore to track which layer the player is on.
  - **ContextDrawer replaces full-screen takeovers**: Room details, NPC dialogue, store UI should render inside the drawer so the map stays visible. Combat is the exception — it still gets the full panel.
  - **Fog of war**: Use the fogOfWar table for region/area discovery. Room-level visibility uses rooms.visited boolean (existing).

  ## Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.
  - All game logic goes in `src/server/game/` — never in components or API routes.
  - tRPC routers are thin wrappers calling game engine functions.
  - Follow existing auth patterns: getOwnedCharacter(db, characterId, userId).
  - Do NOT break existing game functionality for legacy characters.
