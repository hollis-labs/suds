Fullstack Agent (S5 navigation quickfix):

  You are working sprint SPR-20260308-world-redesign-s5-quickfix (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in
  THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint fixes 6 wiring gaps and bugs found during Sprint 5 Navigation review. The components and endpoints all exist and are well-built — the issues are integration gaps where things aren't connected, plus a few backend bugs.

  ## Context: What S5 Built

  Sprint 5 added world navigation to the game:
  - `src/components/game/WorldMapView.tsx` — pick-and-go region selection (renders region nodes with PixelCard)
  - `src/components/game/RegionMapView.tsx` — pick-and-go area selection (renders area nodes with SpriteIcon)
  - `src/components/game/RoomDetailDrawer.tsx` — room interactions in ContextDrawer
  - TileMap integration in game page for area/building exploration
  - Breadcrumb navigation below the map
  - 7 new tRPC endpoints in game.ts: getWorldMap, getRegionMap, travelToRegion, travelToArea, enterBuilding, exitBuilding, changeFloor
  - `src/server/game/navigation.ts` — navigation logic (discovery, travel, building entry/exit, floor changes)
  - HierarchicalPosition type, navigationLayer + navigationNames in gameStore
  - "world_map" and "region_map" added to GameState.screen union

  ## Existing Architecture (DO NOT change these patterns)

  - Game page: `src/app/(game)/play/[characterId]/page.tsx`
  - Game store: `src/stores/gameStore.ts` (Zustand, simple setters)
  - Types: `src/lib/types.ts` (Position, HierarchicalPosition, GameState.screen union, isLegacyPosition)
  - tRPC queries use `api.game.getWorldMap.useQuery(...)` pattern
  - tRPC mutations use `api.game.travelToRegion.useMutation(...)` with onSuccess callbacks
  - Legacy check: `const isWorldCharacter = !!player?.worldId`
  - Auth pattern: `getOwnedCharacter(db, characterId, userId)` in tRPC routers

  ## Tasks in order:

  1. TASK-20260308-145 — Add worldId to store.ts buildPlayer function
     **1-line fix.** In `src/server/trpc/routers/store.ts`, the `buildPlayer()` function is missing `worldId` in its return object. Game.ts and combat.ts both include it. Add `worldId: character.worldId ?? null` to match.

  2. TASK-20260308-146 — Fix exitBuilding to return player to building entrance position
     In `src/server/game/navigation.ts`, `exitBuilding()` always resets position to {0, 0}.
     Fix:
     - Look up the building being exited (the character should have a buildingId tracked, or accept it as a parameter)
     - Read the building's `position` field from the buildings table (jsonb {x, y} — the building's tile on the area grid)
     - Set character position to that {x, y} instead of {0, 0}
     - Fallback: if position unavailable, use area center (gridWidth/2, gridHeight/2)

  3. TASK-20260308-147 — Persist current floor to character state
     The `changeFloor()` endpoint returns the new floor but doesn't save it. On reload, player defaults to floor 0.
     Fix:
     - Add nullable `currentFloor` integer column to characters table in `src/server/db/schema.ts`
     - Run `pnpm db:push` after schema change
     - In navigation.ts: `changeFloor()` persists floor to `characters.currentFloor`
     - In navigation.ts: `enterBuilding()` sets currentFloor = 0
     - In navigation.ts: `exitBuilding()` sets currentFloor = null
     - On game load (game.ts getMap or character load), if character has currentFloor, use it

  4. TASK-20260308-142 — Wire WorldMapView and RegionMapView rendering in game page
     **This is the biggest task.** WorldMapView and RegionMapView are imported but never rendered in the JSX.
     Fix in `src/app/(game)/play/[characterId]/page.tsx`:
     - Add tRPC queries:
       ```
       const worldMapQuery = api.game.getWorldMap.useQuery({ characterId }, { enabled: screen === "world_map" && isWorldCharacter })
       const regionMapQuery = api.game.getRegionMap.useQuery({ characterId, regionId: currentRegionId }, { enabled: screen === "region_map" && !!currentRegionId })
       ```
     - Add tRPC mutations for travelToRegion and travelToArea (if not already present)
     - Add conditional rendering:
       - When `screen === "world_map"`: render WorldMapView with worldMapQuery.data, wire onSelectRegion → travelToRegion mutation → on success set screen to "region_map" + update navigationLayer + update navigationNames
       - When `screen === "region_map"`: render RegionMapView with regionMapQuery.data, wire onSelectArea → travelToArea mutation → on success set screen to "exploring" + update navigationLayer + update navigationNames
     - Need to track currentRegionId in component state (or derive from navigation data) for the regionMap query
     - Add a way to reach world_map screen: e.g., a "World Map" button when in area exploration, or via Breadcrumb clicking the world segment

  5. TASK-20260308-143 — Populate navigationNames and wire Breadcrumb visibility
     `setNavigationNames` exists in gameStore but is never called. Breadcrumb renders conditionally on `navigationNames.worldName` — so it never shows.
     Fix:
     - Destructure `setNavigationNames` from game store in the page component
     - On initial load for world characters: fetch world/region/area names and call setNavigationNames
     - In every navigation transition's onSuccess callback (travelToRegion, travelToArea, enterBuilding, exitBuilding), update navigationNames with the new entity names
     - When navigating up, clear child names (e.g., exiting building → clear buildingName)
     - Extract the inline IIFE breadcrumb segment builder to a useMemo for clarity

  6. TASK-20260308-149 — Fix handleTileClick to check current tile before opening drawer
     `handleTileClick` in the game page opens RoomDetailDrawer for any tile click. Should only open for current player tile.
     Fix:
     - Check if clicked (x, y) matches player position before opening drawer
     - Adjacent walkable tile clicks → trigger movement (existing onMove logic)
     - Non-adjacent clicks → "too far" feedback (existing red flash)
     - Hidden tile clicks → no action
     - Also check that buildingId is being populated in TileData for building entrance tiles. If rooms at building entrance positions don't have buildingId set, the enterBuilding click handler won't fire. May need to populate buildingId in buildTileFromRoom() by cross-referencing building positions.

  ## Key Notes:

  - Tasks 1-3 are backend fixes — can be done quickly and independently.
  - Task 4 is the biggest — it's the core wiring that makes world/region navigation actually work.
  - Task 5 depends on task 4 (needs the navigation queries/mutations to exist before wiring names).
  - Task 6 is a UX fix that can be done independently.
  - All changes must maintain backward compatibility — legacy characters (worldId === null) must continue working with the old MapPanel.
  - Run `pnpm typecheck` after each task.

  ## Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Run `pnpm db:push` after any schema changes (task 3).
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.
  - Do NOT break existing game functionality for legacy characters.
