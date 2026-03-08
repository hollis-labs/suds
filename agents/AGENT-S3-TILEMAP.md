Frontend Agent (tile map renderer):

  You are working sprint SPR-20260308-world-redesign-s3-tilemap (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in
  THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos. Do NOT modify src/server/ — this is a frontend-only sprint.

  This sprint builds the tile map renderer — the core gameplay map that replaces the ASCII MapPanel. Reference: docs/WORLD-REDESIGN-PLAN.md (Sprint 3 section).

  ## What Already Exists (Sprint 2 output — DO NOT recreate)

  Pixel component library is complete:
  - `src/lib/sprites.ts` — SpriteId type, SPRITES config, getSprite(), getSpritesByPrefix()
  - `src/components/pixel/SpriteIcon.tsx` — renders a sprite from the sheet via CSS background-position
  - `src/components/pixel/PixelButton.tsx` — 4 variants (action/nav/danger/info)
  - `src/components/pixel/PixelBadge.tsx` + `HudBar.tsx` — HP/MP/Gold/Level display
  - `src/components/pixel/Breadcrumb.tsx` — navigation breadcrumb
  - `src/components/pixel/ContextDrawer.tsx` — slide-in detail panel
  - `src/components/pixel/PixelCard.tsx` — styled container card

  Real sprite sheets exist at `public/sprites/`:
  - terrain-ground-tiles.png — 9 ground tiles (grass, stone, water, road, forest, mountain, sand, dirt, bridge)
  - terrain-interior-tiles.png — 6 interior tiles (wall, door, stairs_up, stairs_down, floor_wood, lava)
  - map-markers.png — 8 markers (player, npc, loot, encounter, entrance, quest, campfire, other_player)
  - building-town-icons.png, building-special-icons.png, ui-hud-icons.png, region-banners.png, etc.

  SpriteId values for terrain: terrain_grass, terrain_stone, terrain_water, terrain_road, terrain_forest, terrain_mountain, terrain_sand, terrain_dirt, terrain_bridge, terrain_wall, terrain_door, terrain_stairs_up, terrain_stairs_down, terrain_floor_wood, terrain_lava
  SpriteId values for markers: marker_player, marker_npc, marker_loot, marker_encounter, marker_entrance, marker_quest, marker_campfire, marker_other_player
  SpriteId values for buildings: building_tavern, building_shop, building_temple, building_house, building_castle, building_dungeon, building_tower, building_ruins

  Existing game types are in `src/lib/types.ts` (Room, Direction, etc.) and `src/lib/constants.ts` (RoomType, Theme, ROOM_TYPES).
  Existing map renderer: `src/components/game/MapPanel.tsx` — the ASCII map being replaced. Study it for game state patterns and data flow.
  Existing keyboard hook: `src/hooks/useKeyboard.ts` — reuse or extend for arrow/WASD support.
  Existing map logic: `src/server/game/map.ts` — contains MAP_DEAD_ZONE pattern for viewport scrolling reference.

  Stack: Next.js 15, React 19, TypeScript, Shadcn/ui + Tailwind CSS 4. New components go in `src/components/pixel/`.

  ## Tasks in order:

  1. TASK-20260308-070 — Define tile data types and mapping functions
     Create `src/lib/tile-types.ts` with:
     - TileData interface: { x, y, spriteId: SpriteId, walkable, discovered, visible, markers: TileMarker[], roomId?, buildingId? }
     - TileMarker type: "player" | "npc" | "loot" | "encounter" | "entrance" | "exit" | "quest" | "campfire" | "other_player"
     - TileMapData interface: { width, height, tiles: TileData[][] }
     - roomTypeToSpriteId(roomType: RoomType): SpriteId — map corridor→terrain_stone, chamber→terrain_dirt, shrine→terrain_sand, etc.
     - roomFeaturesToMarkers(features, hasEncounter, hasLoot): TileMarker[]
     - buildTileFromRoom(room: Room, playerPos, discovered): TileData

  2. TASK-20260308-071 — Build TileMap core component
     Create `src/components/pixel/TileMap.tsx`:
     - Props: mapData: TileMapData, playerPosition, viewportWidth (default 15), viewportHeight (default 11), tileScale (default 2 = 32px), onTileClick?, className?
     - CSS Grid layout: grid-template-columns: repeat(viewportWidth, tileSize)
     - Each cell renders SpriteIcon for terrain + marker overlays (absolute positioned)
     - Player marker always on top
     - Three visual states: hidden (solid black), discovered (40% brightness + desaturated), visible (full color)
     - Viewport shows window centered on player
     - Do NOT implement scrolling or click-to-move yet

  3. TASK-20260308-072 — Implement player movement and click-to-move
     Add to TileMap:
     - Click walkable adjacent tile → fire onTileClick(x, y)
     - Click non-adjacent → brief red flash feedback
     - Click hidden → no action
     - Player marker CSS transition: transform 150ms ease-out
     - Arrow keys + WASD via keyboard hook
     - Walkability: tile.walkable === true AND adjacent (cardinal, no diagonal)

  4. TASK-20260308-073 — Implement fog of war rendering
     Three CSS class-based states:
     - .tile-hidden: solid dark (#0a0a0a), reveals nothing
     - .tile-discovered: filter: brightness(0.4) saturate(0.3), structural markers only (no encounter/loot)
     - .tile-visible: full color, all markers shown, current tile gets glow
     - Use CSS classes (not inline styles) for paint performance

  5. TASK-20260308-074 — Implement viewport scrolling
     - Fixed viewport window (e.g., 15x11 tiles)
     - Player centered; dead zone in outer ~40% triggers scroll
     - Smooth CSS transition on viewport shift (transform translate, 200ms)
     - Clamp to map boundaries
     - Small maps: center with void/dark around edges
     - Only render tiles within viewport bounds (performance)
     - Reference MAP_DEAD_ZONE pattern in src/server/game/map.ts

  6. TASK-20260308-075 — Build tile map test page
     Create `src/app/(game)/dev/tilemap/page.tsx`:
     - Generate mock 25x25 grid with mixed terrain, building entrances, markers
     - Fog of war: center visible, surrounding discovered, edges hidden
     - Player starts in center, click-to-move works and updates fog
     - Keyboard movement works
     - Display current tile info below map
     - Dev-only (NODE_ENV guard)

  7. TASK-20260308-076 — Add tile info tooltip and room detail interaction
     - Desktop: hover tooltip showing tile name, type, markers
     - Mobile: long-press (500ms) shows same tooltip
     - Click current tile fires onTileClick for room detail drawer
     - Cursor: pointer on walkable adjacent + current, default on others

  ## Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.
  - Use the existing SpriteIcon component to render sprites — do NOT create a new rendering approach.
  - The TileMap is a DOM-based renderer (CSS Grid + divs), NOT canvas.
