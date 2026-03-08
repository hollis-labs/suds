Frontend Agent (Dungeon Map Renderer):

  You are working sprint SPR-20260308-dungeon-map-renderer (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint builds a new dungeon map renderer that shows rooms as large spatial rectangles connected by corridors, matching the visual design in the screenshot mockup. This replaces the TileMap grid renderer for area/building exploration. It also fixes color palette issues and restores keyboard shortcut badges on buttons.

  ## Visual Reference

  **CRITICAL**: Open and study the screenshot at `/Users/chrispian/Documents/Screenshots/CleanShot 2026-03-08 at 12.51.41@2x.png` — this is the authoritative reference for the dungeon map design. It shows: rooms as large bordered rectangles, corridors as thick lines connecting them, Icon symbols for entities (player, NPC, encounter, feature), and a mini map with room info in the top-right corner. Match it as closely as possible.

  ## Color Palette (MANDATORY — use these, not blue/gray)

  The previous pixel UI sprint incorrectly changed colors to blue/gray. Revert to the green-tinted terminal palette used throughout the mockup:

  ```
  Background:      #0a0f0a  (very dark green-black)
  Background alt:  #0d140d  (slightly lighter, for panels/bars)
  Green:           #33ff33  (primary accent, player, highlights)
  Green dim:       #1a8c1a  (secondary text, visited rooms)
  Green muted:     #145214  (tertiary, subtle elements)
  Border:          #1a3a1a  (standard borders)
  Border bright:   #2a5a2a  (emphasized borders)
  Amber:           #ffaa00  (gold, current room border, loot)
  Red:             #ff4444  (danger, encounter rooms, HP low)
  Blue:            #44aaff  (MP, NPC markers, companions)
  Purple:          #aa66ff  (XP, shrines)
  Gold:            #ffd700  (gold count, store markers)
  White:           #c8e6c8  (high-contrast text)
  ```

  These map to Tailwind with inline styles or custom CSS variables. The existing `terminal-*` color tokens in Tailwind config may already match some of these. Reference the screenshot for how these colors look in practice.

  ## What Exists Now

  ### Play Page (`src/app/(game)/play/[characterId]/page.tsx` — ~1780+ lines)
  The page has two layout branches:
  - `isWorldCharacter` → pixel layout (currently uses TileMap, blue/gray colors, PixelButton/PixelModal)
  - `!isWorldCharacter` → terminal layout (legacy, do NOT touch)

  The pixel layout branch is what you'll be modifying. It currently renders:
  - HudBar (sprite badges — keep but restyle colors)
  - TileMap (CSS grid of sprite tiles — REPLACE with DungeonMap for area/building)
  - Breadcrumb (hierarchy navigation — keep)
  - TextPanel with isPixelMode (room desc + game log — restructure per mockup)
  - PixelButton action bar (no key badges — FIX)
  - PixelModal overlays (blue/gray — restyle colors)
  - CombatPanel with isPixelMode (blue/gray — restyle colors)
  - WorldMapView + RegionMapView (render for world/region layers — keep as-is)

  ### Map Data Available
  The `mapViewport` from the game store has this shape:
  ```typescript
  interface MapViewport {
    cells: MapCell[][];  // 2D grid, typically 15x11
    center: { x: number; y: number };
  }
  interface MapCell {
    x: number;
    y: number;
    room: Room | null;
    isCurrent: boolean;
  }
  interface Room {
    id: string;
    x: number; y: number;
    name: string;
    type: string;  // "corridor" | "chamber" | "shrine" | "trap_room" | "store" | "npc_room" | "boss_room" | "safe_room"
    description: string;
    exits: string[];  // ["north", "east", "south", "west"]
    depth: number;
    hasEncounter: boolean;
    encounterData: any;
    hasLoot: boolean;
    lootData: any;
    visited: boolean;
    roomFeatures: Record<string, any>;  // { campfire?: bool, altar?: bool, trap?: bool, chest?: bool, searched?: bool }
  }
  ```

  ### Navigation Layers
  - `navigationLayer: "world" | "region" | "area" | "building"`
  - World + Region layers: use WorldMapView / RegionMapView (existing, keep as-is)
  - Area + Building layers: use the NEW DungeonMap (this sprint)
  - The `screen` state controls which view shows: "exploring", "world_map", "region_map", "combat", etc.

  ### Existing Components to Keep
  - `src/components/pixel/TileMap.tsx` — don't delete, but stop using it for world characters
  - `src/components/pixel/Breadcrumb.tsx` — keep, it works
  - `src/components/pixel/HudBar.tsx` — keep but restyle colors
  - `src/components/pixel/PixelModal.tsx` — keep but restyle colors
  - `src/components/pixel/PixelButton.tsx` — keep but restyle/add key badges
  - `src/components/game/WorldMapView.tsx` — keep as-is
  - `src/components/game/RegionMapView.tsx` — keep as-is
  - `src/components/game/RoomDetailDrawer.tsx` — keep, used when clicking current room
  - `src/components/game/CombatPanel.tsx` — keep but restyle colors
  - `src/components/game/TextPanel.tsx` — may be replaced by new room info panel

  ## Tasks in order:

  1. TASK-20260308-168 — Build DungeonMap component
     Create `src/components/game/DungeonMap.tsx`:

     **Core concept**: Each room in mapViewport.cells becomes a large rectangle on a spatial canvas. Rooms are connected by corridor lines based on their `exits` arrays.

     **Room rendering**:
     - Each room is a rectangle, roughly 120-180px wide × 80-120px tall (scale to fit viewport)
     - Rooms are positioned based on their (x, y) grid coordinates, with spacing for corridors between them
     - Border color indicates room state:
       - Current room (isCurrent): amber/gold border (#ffaa00), slightly brighter background
       - Visited room: dim gray-green border (#1a3a1a)
       - Encounter room (hasEncounter): red border (#ff4444)
       - Store room: gold border (#ffd700)
       - NPC room: blue border (#44aaff)
       - Shrine: purple border (#aa66ff)
     - Room interior: dark background (#0d140d or slightly varied)
     - Previous ASCII entity markers centered/scattered in the room - Use icons/svgs instead.
       - `@` (green #33ff33, bold) — player, only in current room
       - `n` (blue #44aaff) — NPC present
       - `$` (gold #ffd700) — store
       - `*` (amber #ffaa00) — item/feature/campfire
       - `x` (red #ff4444) — encounter/monster
       - `^` (purple #aa66ff) — shrine
       - `?` (dim #1a3a1a) — fog/undiscovered
     - Room name shown inside or below the rectangle in small text

     **Corridors**:
     - When room A at (x,y) has exit "east" and room B at (x+1,y) exists, draw a horizontal corridor line between them
     - Corridor: thick gray line (#1a3a1a, ~4-6px wide) connecting the room edges
     - Door markers: small amber squares (~8-10px) at the connection points on room edges
     - Corridors only drawn between rooms that both exist and have matching exits

     **Background**:
     - Dark background (#0a0f0a) with subtle grid pattern
     - Grid: very faint lines (#0d140d or slightly lighter) every ~40px, creating a graph-paper feel
     - Use CSS `background-image: repeating-linear-gradient(...)` for the grid

     **Implementation approach**:
     - Use absolute positioning within a relative container
     - Calculate room positions: `room.x * ROOM_SPACING_X`, `room.y * ROOM_SPACING_Y`
     - Where ROOM_SPACING accounts for room size + corridor gap
     - Corridors can be div elements with absolute positioning between rooms
     - Alternatively, use SVG for corridors (lines) with HTML overlaid for rooms
     - The container should be scrollable (overflow: auto) for large dungeons

     **Fog of war**:
     - Rooms with `visited: false` and not current: show as dim outline only, no interior details
     - Rooms not in the viewport data at all: not rendered (black space)
     - Current room + adjacent rooms with exits: fully visible

     **Click handlers**:
     - Click current room → callback to open room details
     - Click adjacent visited room → callback to move there (triggers move mutation)
     - Click non-adjacent room → no action or subtle feedback
     - Click fog room → no action

     Props:
     ```typescript
     interface DungeonMapProps {
       viewport: MapViewport;
       playerPosition: { x: number; y: number };
       onRoomClick: (x: number, y: number, room: Room) => void;
       onMoveToRoom: (x: number, y: number) => void;
       className?: string;
     }
     ```

  2. TASK-20260308-169 — Build MiniMap component
     Create `src/components/game/MiniMap.tsx`:

     **Concept**: A small abstract grid (150-200px wide) showing all discovered rooms as tiny colored squares. Provides broader context for the dungeon layout.

     **Rendering**:
     - Each room = small square (6-8px) with 1-2px gap
     - Color by state:
       - Current: bright green (#33ff33)
       - Visited: dim green (#1a3a1a)
       - Encounter: dim red
       - Store: dim gold
       - Fog/undiscovered: barely visible (#0d140d)
     - Grid background matching main map
     - Thin border around the mini map

     **Room info below mini map**:
     - Current room name in small text
     - Brief room description (first sentence)

     Props:
     ```typescript
     interface MiniMapProps {
       viewport: MapViewport;
       playerPosition: { x: number; y: number };
       onRoomClick?: (x: number, y: number) => void;
       className?: string;
     }
     ```

  3. TASK-20260308-170 — Wire DungeonMap into play page
     In the pixel layout branch of the play page:
     - Replace TileMap with DungeonMap for `screen === "exploring"` when `navigationLayer === "area" || navigationLayer === "building"`
     - Keep WorldMapView for `screen === "world_map"` and RegionMapView for `screen === "region_map"` — unchanged
     - DungeonMap receives `mapViewport` from game store
     - Wire onRoomClick: if current room → setDrawerOpen(true), if adjacent → moveMutation
     - Wire keyboard movement: keep existing WASD/arrow handling (it calls moveMutation with direction)
     - MiniMap positioned in the right panel or overlaid on the map (top-right corner)
     - Remove TileMap import from pixel layout (but don't delete the component)
     - Remove the `tileMapData` useMemo computation (or guard it with a condition so it doesn't waste cycles)

  4. TASK-20260308-171 — Restore green palette and keyboard shortcut badges
     This is critical for the look and feel:

     **Color restoration** — go through the pixel layout and ALL pixel components used by world characters:
     - HudBar: change `bg-black/80 border-b border-gray-700` → `bg-[#0d140d] border-b border-[#1a3a1a]`
     - HudBar badges: update PixelBadge colors to match palette (HP=red, MP=#44aaff, Gold=#ffd700, Level=#33ff33)
     - PixelModal: change `bg-gray-900 border-gray-600` → `bg-[#0d140d] border-[#1a3a1a]` with green-tinted text
     - CombatPanel isPixelMode colors: change all gray-* to green-tinted equivalents
     - TextPanel isPixelMode colors: same treatment
     - Action buttons: see below
     - Any other pixel-mode component: search for `gray-` in pixel layout and replace with palette colors

     **Action button keyboard badges**:
     ```html
     <button class="action-btn">
       <span class="key-badge">X</span>Search
     </button>
     ```
     Each action button shows a small highlighted square with the keyboard shortcut letter.
     Key badge styling: `inline-flex items-center justify-center w-5 h-5 rounded-sm bg-[#1a3a1a] text-[#33ff33] text-[10px] font-bold`

     Buttons to have badges:
     - [X] Search, [R] Rest, [F] Shrine, [T] Talk, [B] Shop (context-dependent)
     - [I] Inventory, [C] Character, [L] Codex, [P] Party, [N] News, [~] About, [?] Help, [Q] Exit

     **Fix Escape key behavior**:
     In the keyboard handler, Escape should:
     1. If a modal is open → close the modal (current behavior for some cases)
     2. If drawer is open → close the drawer
     3. If no modal/drawer open and screen is "exploring" → do NOTHING (not open world map)
     4. Only navigate to world map via explicit breadcrumb click or M key
     Find where Escape triggers world_map and remove/fix that logic.

  5. TASK-20260308-172 — Room info panel
     Build the room info panel that sits beside the map (desktop) or in a tab (mobile):

     **Desktop layout** (right of map):
     - Room name as header (green, bold)
     - Room type label (dim, uppercase, small)
     - Description text (dim green, relaxed line height)
     - Exits as clickable chips: `[W] North  [D] East  [S] South` — clicking triggers move
     - Room features as small badges (campfire=amber, altar=blue, trap=red, chest=gold)
     - Separator line
     - Recent game log (last 5 entries, scrollable)

     **Mobile layout**:
     - Tabbed interface: Room | Map | Log
     - Room tab: room info (default visible)
     - Map tab: DungeonMap (expands to fill)
     - Log tab: full game log
     - Tabs styled with green palette (active=bright green border-bottom, inactive=dim)

     Create this as a new component `src/components/game/RoomInfoPanel.tsx` or inline in the play page pixel layout.

  6. TASK-20260308-173 — Viewport scrolling and pan
     DungeonMap viewport management:
     - Auto-center on current room when entering the map
     - When player moves, smoothly pan to keep current room visible
     - Dead-zone approach: only scroll when current room is within 1 room of viewport edge
     - Use CSS `scroll-behavior: smooth` on the container, or `element.scrollTo({ behavior: 'smooth' })`
     - MiniMap click: scroll the main map to center on the clicked room
     - Mobile: allow touch drag to pan the map (native overflow scroll handles this)
     - Ensure map doesn't scroll beyond bounds

  7. TASK-20260308-174 — Responsive layout
     3 breakpoints:

     **Mobile (<768px)**:
     - Top bar: Compact — "SUDS | Name Lv.X Class" + gold, HP/MP bars below
     - Tabbed content: Room (default) | Map | Log
     - Room tab: room name, desc, exits, features, mini map preview, recent log
     - Map tab: DungeonMap filling available space + DPad below it
     - Log tab: full scrollable game log
     - Bottom: action buttons in scrollable row with key badges

     **Tablet (768px-1199px)**:
     - Top bar: full stats with HP/MP/XP bars + gold + ally
     - Split: Map left (40%) | Room+Log right (60%)
     - Map includes DPad below it and legend
     - Bottom: action buttons centered

     **Desktop (1200px+)**:
     - Top bar: full info including position, all bars, ally, buffs
     - 3 columns: Map (30%) | Room+Log (flex) | Actions sidebar (180px)
     - Actions sidebar: context actions, divider, panel buttons, divider, DPad
     - Bottom: keyboard hints bar (dim, informational only)
     - Max width: 1400px centered

     Run `pnpm typecheck` and `pnpm build` after all changes.

  ## Critical Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.
  - Do NOT modify legacy character layout (the `!isWorldCharacter` branch).
  - Do NOT change game logic, tRPC routers, or database schema. Frontend only.
  - Do NOT delete TileMap component — it may be used later for other layers.
  - Do NOT delete terminal components — they're used by legacy characters and other pages.
  - All hooks must remain above early returns in the play page (hooks ordering rule).
  - NO sprites in the DungeonMap — use pure CSS + Icons (no emoji).
  - The DungeonMap renders rooms from the same `mapViewport` data that TileMap used — no backend changes needed.
  - The screenshot (`/Users/chrispian/Documents/Screenshots/CleanShot 2026-03-08 at 12.51.41@2x.png`) is the authoritative visual reference. Match its room sizing, corridor style, and layout.
  - Use JetBrains Mono or the existing `font-mono` for all game text.
  - The HUD bar format: `SUDS | Name | Lv.X Class | HP [bar] XX/XX | MP [bar] XX/XX | Gold: XXX`
  - `text-shadow: 0 0 8px rgba(51, 255, 51, 0.4)` for the terminal glow effect on important green text.
