# World Navigation & Pixel Art UI Redesign — Implementation Plan

## Overview

Transform SUDS v2 from a single dungeon crawler with CRT terminal aesthetics into a realm-based exploration game with pixel art RPG visuals. The game expands from flat (x,y) room grids per character to a shared world with layered navigation: World > Region > Area > Building/Dungeon > Room.

**Design doc:** See memory file `world-navigation-design.md` for full design direction.

## Guiding Principles

- **Parallel where possible** — Art, components, and schema work can happen simultaneously
- **Placeholder-first** — Use colored rectangles/simple shapes until real sprites are ready
- **Side-by-side** — Current terminal game stays playable until migration in Sprint 7
- **Server-side logic** — All world generation, navigation, and state lives in `src/server/game/`
- **Mobile-first** — Map gets 70%+ viewport; drawers, not panels

## Deferred (Post-v1 of Redesign)

- Pinch-to-zoom on mobile maps
- Sound effects
- World server selector (multiple themed servers)
- Player-to-player trading
- Real-time multiplayer presence (websockets)

---

## Current State Reference

### Schema (what exists today)
- `rooms` — flat (x, y) per character, no hierarchy. Columns: characterId, x, y, name, type, description, exits, depth, hasEncounter, encounterData, hasLoot, lootData, visited, roomFeatures
- `characters` — position as `{x, y}` jsonb, per-user
- `stores`, `npcs`, `quests` — tied to characterId + roomX/roomY
- `contentLibrary` — reusable AI-generated content by type/theme
- `loreEntries` — per-character discovered lore

### Client types (what the UI expects)
- `Room` interface: id, x, y, name, type, description, exits, depth, encounter/loot data, visited, roomFeatures
- `MapCell` / `MapViewport`: 15x11 grid viewport with fog of war
- `GameState.screen`: exploring | combat | store | npc | inventory | character | death | level_up | lore | party | news | about
- Direction: "north" | "south" | "east" | "west"

### Server game engine
- `src/server/game/world.ts` — `generateRoom()`, `generateStartingRoom()`, `pickRoomType()`, `generateExits()`
- `src/server/game/encounters.ts` — `generateEncounter()` with level scaling
- `src/server/game/map.ts` — viewport computation
- `src/server/game/loot.ts`, `combat.ts`, `store.ts`, `npc.ts`, `player.ts`
- `src/server/game/content-library.ts` — `selectOrGenerate()` for AI content reuse

### Components
- `src/components/game/` — MapPanel, CombatPanel, StorePanel, NPCDialog, CharacterSheet, etc.
- `src/components/terminal/` — Terminal-themed wrappers (TerminalCard, TerminalButton, etc.)
- `src/components/ui/` — shadcn base components

---

## Sprint 1: Schema Foundation & World Seed

**Goal:** New DB schema for layered world hierarchy. Seed a starter world. No UI changes yet.

**Why first:** Everything else depends on the data model being right.

### Tasks

#### 1.1 Design and create `worlds` table
```
worlds:
  id: uuid PK
  name: text (e.g., "Aethermoor")
  description: text
  theme: text (default theme for the world)
  seed: text (generation seed for reproducibility)
  createdAt: timestamp
```
- Add to `src/server/db/schema.ts`
- Add Drizzle type exports

#### 1.2 Create `regions` table
```
regions:
  id: uuid PK
  worldId: uuid FK → worlds
  name: text (e.g., "The Ashen Coast")
  description: text
  theme: text (override or inherit from world)
  position: jsonb {x, y} — position on world map
  connections: text[] — array of region IDs this connects to
  metadata: jsonb — landmarks, faction, flavor
  generatedBy: text — "seed" | "ai" | "template"
  createdAt: timestamp
```

#### 1.3 Create `areas` table
```
areas:
  id: uuid PK
  regionId: uuid FK → regions
  name: text (e.g., "Blackmere Village")
  description: text
  areaType: text — "town" | "wilderness" | "ruins" | "fortress" | "dungeon_entrance"
  gridWidth: integer — tile grid width (e.g., 20)
  gridHeight: integer — tile grid height (e.g., 20)
  position: jsonb {x, y} — position on region map
  connections: text[] — adjacent area IDs
  metadata: jsonb — POIs, buildings list, terrain type
  generatedBy: text
  createdAt: timestamp
```

#### 1.4 Create `buildings` table
```
buildings:
  id: uuid PK
  areaId: uuid FK → areas
  name: text (e.g., "The Rusty Tankard")
  description: text
  buildingType: text — "tavern" | "shop" | "temple" | "house" | "castle" | "dungeon"
  floors: integer — number of floors/levels
  gridWidth: integer — interior grid width per floor
  gridHeight: integer — interior grid height per floor
  position: jsonb {x, y} — position on area grid
  metadata: jsonb — NPCs, special features
  generatedBy: text
  createdAt: timestamp
```

#### 1.5 Add hierarchy columns to existing `rooms` table
Add these columns (nullable for backward compat):
```
worldId: uuid FK → worlds (nullable)
regionId: uuid FK → regions (nullable)
areaId: uuid FK → areas (nullable)
buildingId: uuid FK → buildings (nullable)
floor: integer (nullable, for multi-floor buildings)
```
- Existing rooms continue working with null hierarchy fields
- New rooms get full hierarchy populated

#### 1.6 Create `fog_of_war` table
```
fog_of_war:
  id: uuid PK
  characterId: uuid FK → characters
  entityType: text — "region" | "area" | "room"
  entityId: uuid — the region/area/room ID
  discoveredAt: timestamp
  unique(characterId, entityType, entityId)
```
- Per-character visibility tracking
- Rooms already have `visited` boolean, but this covers higher layers

#### 1.7 Add `worldId` to characters table
```
worldId: uuid FK → worlds (nullable)
```
- Nullable for existing characters (they're in "legacy" mode)
- New characters get assigned to a world at creation

#### 1.8 Build world seed script
- Create `src/server/game/world-seed.ts`
- Function: `seedStarterWorld()` — generates 1 world, 3 regions, 2-3 areas per region
- Use existing theme system for region themes
- Use `content-library.ts` pattern for AI-generated descriptions
- Create an admin action or CLI script to trigger seeding
- Seed data should feel like a real fantasy world (not test data)

**Acceptance criteria:** `pnpm db:push` applies cleanly. Seed script creates a browsable world hierarchy in the DB. Existing game still works with no changes.

---

## Sprint 2: Pixel Art Component Library

**Goal:** New visual primitives that replace the CRT terminal style. Placeholder sprites until real art is ready.

**Why now:** Components can be built in parallel with any backend work. They don't depend on the schema.

### Tasks

#### 2.1 Create sprite sheet infrastructure
- Create `public/sprites/` directory
- Build `src/lib/sprites.ts` — sprite sheet config: tile size (16x16 or 32x32), sheet layout, tile ID → position mapping
- Use placeholder colored squares initially (each tile type = different color)
- Define sprite IDs for all needed tiles (see asset list below)

#### 2.2 Build `<PixelButton>` component
- `src/components/pixel/PixelButton.tsx`
- Variants: action (green), nav (gold), danger (red), info (blue)
- Pixel art border style (stepped corners or 1px border with pixel shadow)
- Hover/active states with pixel-appropriate feedback
- Replaces `[BRACKETED]` terminal-style buttons in new UI
- Props: variant, size, disabled, onClick, children

#### 2.3 Build `<PixelBadge>` component
- `src/components/pixel/PixelBadge.tsx`
- Small status indicator: icon + value
- Used for HP, MP, gold, level in the HUD
- Color-coded by type (red=HP, blue=MP, gold=gold, green=level)
- Compact — designed for a single-row HUD bar

#### 2.4 Build `<HudBar>` component
- `src/components/pixel/HudBar.tsx`
- Compact top bar showing player vitals via PixelBadge components
- Layout: `[HP: 24/30] [MP: 12/15] [Gold: 150] [Lv: 5]`
- Fixed to top of game viewport
- Responsive: stacks or abbreviates on very small screens

#### 2.5 Build `<Breadcrumb>` component
- `src/components/pixel/Breadcrumb.tsx`
- Shows navigation hierarchy: `World > Region > Area > Building > Floor`
- Each segment is tappable (navigates up to that layer)
- Back/up button at the start
- Appears below the map
- Props: segments array with { label, onClick }

#### 2.6 Build `<ContextDrawer>` component
- `src/components/pixel/ContextDrawer.tsx`
- Right panel on desktop (300px), bottom sheet on mobile
- Only appears when there's contextual content (room details, NPC, store, combat)
- Slide-in animation
- Close button / swipe to dismiss on mobile
- Props: open, onClose, title, children

#### 2.7 Build `<SpriteIcon>` component
- `src/components/pixel/SpriteIcon.tsx`
- Renders a single sprite from the sprite sheet
- Props: spriteId, size (multiplier for pixel scaling), className
- Uses CSS `image-rendering: pixelated` for crisp scaling
- Serves as the base rendering unit for the tile map

#### 2.8 Build `<PixelCard>` component
- `src/components/pixel/PixelCard.tsx`
- Replaces TerminalCard for the new UI
- Pixel art border, dark background, optional header with icon
- Used for inventory panels, character sheets, store UI, etc.

**Acceptance criteria:** All components render with placeholder art. Storybook-like demo page at `/dev/pixels` (dev only) shows all components in various states.

---

## Sprint 3: Tile Map Renderer

**Goal:** Canvas or DOM-based tile grid that replaces the ASCII map. Supports click-to-move and fog of war.

**Why now:** This is the visual centerpiece. Can be built with mock data before wiring to real world data.

### Tasks

#### 3.1 Build `<TileMap>` core component
- `src/components/pixel/TileMap.tsx`
- Renders a 2D grid of tiles from data: `tiles: TileData[][]`
- Each tile has: spriteId, walkable, discovered, current, hasMarker
- DOM-based initially (CSS grid of `<SpriteIcon>` elements) — canvas later if perf demands it
- Dark background for undiscovered tiles, dim for discovered-but-not-current

#### 3.2 Define tile data types
- `src/lib/tile-types.ts`
- `TileData` interface: spriteId, position, walkable, discovered, markers[], roomId?
- `TileMarker` type: "player" | "npc" | "loot" | "encounter" | "entrance" | "exit"
- Mapping functions: roomType → spriteId, feature → marker

#### 3.3 Player marker and movement
- Player marker sprite rendered on current tile
- Click/tap a walkable adjacent tile to move
- Smooth CSS transition for player marker position (transform translate)
- Arrow key / WASD support (keep existing keyboard handler pattern)
- Emit movement events that the game router handles

#### 3.4 Fog of war rendering
- Three states: hidden (black), discovered (dimmed/desaturated), visible (full color)
- "Visible" = current room + adjacent rooms with exits
- "Discovered" = previously visited
- "Hidden" = everything else
- CSS filter or opacity approach for dim/hidden states

#### 3.5 Viewport and scrolling
- Map viewport centers on player position
- Viewport size: configurable (default ~15x11 tiles, matching current)
- Smooth scroll when player moves near viewport edge
- Clamp viewport to world bounds

#### 3.6 Click-to-move interaction
- Tap/click on visible, walkable, adjacent tile = move there
- Tap on non-adjacent discovered tile = show "too far" feedback
- Tap on hidden tile = no action
- Tap on current tile = show room details in ContextDrawer
- Long-press / right-click on discovered tile = show room info tooltip

#### 3.7 Layer-specific map rendering
- World map: regions as large labeled nodes with connections
- Region map: areas as icons on a simplified grid
- Area map: full tile grid (the main gameplay map)
- Building map: interior tile grid (same renderer, different tile set)
- Room detail: not a map — it's a detail view in the ContextDrawer
- The TileMap component handles Area + Building layers
- World + Region get their own simpler renderers (Sprint 5)

**Acceptance criteria:** TileMap renders a mock 20x20 grid with placeholder sprites, fog of war, player marker, and click-to-move working. Playable in a `/dev/tilemap` test page.

---

## Sprint 4: World Generation Pipeline & Admin Tools

**Goal:** Server-side generators create regions, areas, buildings. Admin can view the world hierarchy.

**Why now:** Schema exists (Sprint 1), now we fill it with content.

### Tasks

#### 4.1 Region generator
- `src/server/game/world-gen/region.ts`
- `generateRegion(worldId, theme, position)` → Region
- AI-assisted: generates name, description, landmarks, faction identity
- Uses `content-library.ts` selectOrGenerate pattern for token savings
- Each region gets 2-4 area connection points
- Theme can override world default or be random variation

#### 4.2 Area generator
- `src/server/game/world-gen/area.ts`
- `generateArea(regionId, areaType, position)` → Area + initial tile grid
- Town areas: generate building positions, roads, gates
- Wilderness areas: generate terrain features, encounter zones
- Dungeon entrances: mark as transition point to building interior
- Grid size varies by type (towns: 15x15, wilderness: 25x25, etc.)

#### 4.3 Building generator
- `src/server/game/world-gen/building.ts`
- `generateBuilding(areaId, buildingType, position)` → Building + floor layouts
- Taverns: common room, rooms upstairs, NPC barkeep
- Shops: storefront with inventory hooks
- Dungeons: multi-floor with increasing depth/difficulty
- Temples: shrine rooms with blessing mechanics
- Reuse existing room generation for interior rooms (with new hierarchy fields)

#### 4.4 Wire generators to content library
- All generators should check `content_library` before calling AI
- Save new AI-generated content back to `content_library` with tags
- Track AI usage costs per generation type
- Template system: high-quality generated content can be flagged as template for reuse

#### 4.5 Admin: World hierarchy browser
- Extend admin panel with world navigation tree
- Tree view: World > Regions > Areas > Buildings
- Click any node to see details + child entities
- Show generation source (seed/ai/template) and quality ratings
- Integrate with existing Admin World Data tab

#### 4.6 Admin: Content template manager
- View content_library entries with quality >= 4
- Promote generated content to "template" status
- Edit/curate templates
- Preview how a template would be used in generation

#### 4.7 Generation cost dashboard
- Extend existing AI usage tracking
- Show cost breakdown by generation type (region vs area vs building vs room)
- Track template reuse rate (how often we skip AI calls)
- This helps us optimize token spend over time

**Acceptance criteria:** Running the generators creates a populated world visible in admin. Content library shows reused content. Cost dashboard shows token savings.

---

## Sprint 5: Navigation System & Game Loop Integration

**Goal:** Wire the full World > Region > Area > Building > Room navigation into the live game. Players can explore the new world.

**Why now:** Schema (Sprint 1), rendering (Sprint 3), and content (Sprint 4) are ready.

### Tasks

#### 5.1 World map view
- New screen: `screen: "world_map"`
- Render world regions as selectable nodes
- Click region → zoom animation → region map view
- Show discovered vs undiscovered regions (fog_of_war table)
- Simple layout: styled list or node graph, not a full tile grid

#### 5.2 Region map view
- New screen: `screen: "region_map"`
- Render areas as icons on a simplified grid
- Click area → travel animation → area grid view
- Show area type icons (town, wilderness, ruins, etc.)
- Travel time concept (optional flavor, no real delay for now)

#### 5.3 Area grid exploration
- This IS the main gameplay — replaces current map
- Uses TileMap component from Sprint 3
- Movement generates rooms on-the-fly (existing pattern, with hierarchy fields)
- Buildings on the area grid are "entrance" tiles — clicking enters the building
- Exits at area edges connect to adjacent areas

#### 5.4 Building/dungeon interior exploration
- Same TileMap renderer, different tile set (interior tiles)
- Multi-floor: stairs up/down change floor, reset grid view
- Existing room types (corridor, chamber, shrine, trap, boss, store, npc, safe) all work here
- Exit tile returns to area grid at building position

#### 5.5 Room detail view
- When player is on a tile, show room details in ContextDrawer
- Room name, description, features, available actions
- NPC interaction, store access, loot pickup — all via drawer
- No separate "room screen" — it's always the map + drawer

#### 5.6 Breadcrumb navigation integration
- Breadcrumb shows current position in hierarchy
- Tap any segment to navigate up (with confirmation if in combat)
- Back button always goes one layer up
- Update `GameState.screen` or add a `navigationLayer` state

#### 5.7 New tRPC endpoints for navigation
- `game.getWorldMap` — returns world + regions (with fog_of_war applied)
- `game.getRegionMap` — returns region + areas (with fog_of_war)
- `game.travelToRegion` — move character to region, update position
- `game.travelToArea` — move character to area
- `game.enterBuilding` — transition to building interior
- `game.exitBuilding` — return to area grid
- `game.changeFloor` — move between building floors

#### 5.8 Update character position model
- Character position expands from `{x, y}` to:
```
{
  worldId: string,
  regionId: string,
  areaId: string,
  buildingId?: string,
  floor?: number,
  x: number,
  y: number
}
```
- Backward compat: legacy characters with just `{x, y}` still work
- Update `characters.position` jsonb structure
- Update all position-reading code to handle both formats

**Acceptance criteria:** A new character can navigate World → Region → Area → Building → Room using the tile map and breadcrumbs. Existing characters still play in legacy mode.

---

## Sprint 6: Polish, Transitions & Mobile UX

**Goal:** Smooth experience across devices. Layer transitions. Responsive layouts.

### Tasks

#### 6.1 Layer transition animations
- Zoom-in animation when selecting a region/area (scale + fade)
- Zoom-out animation when navigating up via breadcrumb
- CSS transitions or Framer Motion
- Keep animations short (300-500ms) to not feel sluggish

#### 6.2 Mobile layout optimization
- Map takes 70%+ of viewport on mobile
- ContextDrawer as bottom sheet (not side panel)
- HudBar compact mode for small screens
- Breadcrumb scrollable on narrow screens
- Action buttons sized for touch (44px+ tap targets)

#### 6.3 Loading states for generation
- Skeleton tiles while areas/rooms are being generated
- "Exploring..." state with subtle animation
- AI generation can be slow — show progress indication
- Pre-generate adjacent areas in background when player is near edge

#### 6.4 Desktop layout refinement
- Side-by-side: map (70%) + context drawer (30%)
- Map controls: zoom buttons, minimap toggle
- Keyboard shortcuts for layer navigation
- Hover tooltips on map tiles

#### 6.5 Combat integration with new map
- Combat still uses existing CombatPanel
- Combat triggers from encountering a tile with encounter data
- After combat, return to map view (drawer closes or shows loot)
- Death/respawn works with new position model (respawn at last safe area)

#### 6.6 Store/NPC integration with new map
- Entering a store building or store tile opens store in ContextDrawer
- NPC interaction happens in ContextDrawer
- Quest givers show markers on map tiles
- Store inventory tied to building (shared world) not character position

#### 6.7 Performance pass
- Virtualize tile rendering for large grids (only render visible tiles)
- Lazy load sprite sheet
- Cache generated content aggressively
- Profile and fix any jank in map scrolling

#### 6.8 Cross-device testing
- Test on: iPhone Safari, Android Chrome, desktop Chrome/Firefox/Safari
- Fix any touch handling issues
- Verify responsive breakpoints
- Test with slow network (3G throttle) for generation loading states

**Acceptance criteria:** Game is smooth on mobile and desktop. Transitions feel good. No jank. Loading states are informative.

---

## Sprint 7: Shared World Features & Legacy Migration

**Goal:** All players share the same generated world. Migrate existing characters into the new system.

### Tasks

#### 7.1 Shared world infrastructure
- New characters created in the shared world (same worldId)
- Rooms generated by one player are visible to others (if they discover them)
- Content (stores, NPCs) is per-building, not per-character
- Combat encounters are per-character (you don't steal someone's fight)

#### 7.2 Shared entity refactoring
- `stores` table: remove characterId, add buildingId FK
- `npcs` table: remove characterId, add buildingId or areaId FK
- Stores and NPCs belong to the world, not to a character
- Character-specific data (quests, lore, fog_of_war) stays per-character

#### 7.3 Player presence markers (basic)
- Show other players' positions on the area map
- Simple marker: different color player icon
- Click marker to see player name + level + class
- No real-time sync yet — update on room entry/exit (poll or stale data is fine)

#### 7.4 Legacy character migration script
- Script that migrates existing characters into the shared world
- Maps current `{x, y}` positions into an area within the world
- Creates fog_of_war entries for all rooms they've visited
- Preserves all inventory, stats, quests
- Run as one-time migration, then legacy mode is removed

#### 7.5 Legacy room data migration
- Existing rooms (flat x,y per character) → rooms within an area
- Group nearby rooms into logical areas
- Assign buildings for store/NPC rooms
- Add hierarchy fields (worldId, regionId, areaId, buildingId)

#### 7.6 Remove legacy map renderer
- Feature-flag old terminal ASCII map behind `LEGACY_MAP` env var
- Remove feature flag after confirming migration works
- Clean up old MapPanel, terminal map CSS
- Keep terminal components that are still used elsewhere (TerminalCard, etc.)

#### 7.7 Integration testing & deploy
- Full gameplay test: create character → explore → combat → store → NPC → quest
- Test migration on staging with production data copy
- Performance test with multiple concurrent players
- Deploy to production
- Monitor for errors post-deploy

**Acceptance criteria:** All existing characters migrated. New and old players share the same world. Legacy terminal map is removable. Production deploy is stable.

---

## Asset List

### Terrain Tiles (16x16 or 32x32)
| ID | Name | Usage |
|----|------|-------|
| terrain_grass | Grass | Default outdoor tile |
| terrain_stone | Stone Floor | Interior/dungeon default |
| terrain_water | Water | Rivers, lakes (impassable) |
| terrain_road | Road/Path | Walkable roads in towns |
| terrain_forest | Forest | Trees, partial visibility |
| terrain_mountain | Mountain | Impassable terrain |
| terrain_sand | Sand | Desert/beach areas |
| terrain_dirt | Dirt | Trails, clearings |
| terrain_bridge | Bridge | Crosses water |
| terrain_wall | Wall | Interior walls (impassable) |
| terrain_door | Door | Passable wall segment |
| terrain_stairs_up | Stairs Up | Floor transition |
| terrain_stairs_down | Stairs Down | Floor transition |

### Building Icons (for area map)
| ID | Name | Usage |
|----|------|-------|
| building_tavern | Tavern | Rest, NPC hub |
| building_shop | Shop | Store |
| building_temple | Temple | Shrine/healing |
| building_house | House | Generic building |
| building_castle | Castle Gate | Major landmark |
| building_dungeon | Dungeon Entrance | Leads to interior |
| building_tower | Tower | Wizard/lookout |
| building_ruins | Ruins | Explorable ruins |

### Markers
| ID | Name | Usage |
|----|------|-------|
| marker_player | Player | Current player position |
| marker_npc | NPC | NPC present on tile |
| marker_loot | Loot | Uncollected loot |
| marker_encounter | Encounter | Monster/danger |
| marker_entrance | Entrance | Building entrance |
| marker_quest | Quest | Quest objective/giver |
| marker_campfire | Campfire | Safe room indicator |
| marker_other_player | Other Player | Shared world presence |

### UI Elements
| ID | Name | Usage |
|----|------|-------|
| ui_heart | Heart | HP badge |
| ui_mana | Mana Drop | MP badge |
| ui_coin | Gold Coin | Gold badge |
| ui_star | Star | Level badge |
| ui_sword | Sword | Attack indicator |
| ui_shield | Shield | Defense indicator |
| ui_skull | Skull | Death/danger |
| ui_chest | Chest | Loot/inventory |

### Region Banners (larger, ~32x48 or 64x64)
| ID | Name | Usage |
|----|------|-------|
| banner_ashen | Ashen Coast | Dark/horror region |
| banner_verdant | Verdant Vale | Nature/forest region |
| banner_iron | Iron Peaks | Mountain/fortress region |

---

## Nanobanana Sprite Prompts

See `docs/pixel-art-prompts.md` for ready-to-use prompts for generating all needed sprites.
