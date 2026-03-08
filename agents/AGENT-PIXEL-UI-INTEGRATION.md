Frontend Agent (Pixel UI Integration):

  You are working sprint SPR-20260308-pixel-ui-integration (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint replaces the terminal/CRT aesthetic with a pixel RPG aesthetic for world characters (characters with worldId set). Legacy characters (worldId === null) keep the existing terminal UI. All pixel UI components already exist — the work is wiring them into the play page and game panels.

  ## Current State

  ### Play Page (`src/app/(game)/play/[characterId]/page.tsx` — ~1780 lines)
  The play page currently wraps EVERYTHING in old terminal components:
  - `TerminalHUD` as the outer shell (green-bordered box with top/bottom bars)
  - `StatusBar` as the top bar (ASCII HP/MP bars, terminal-green text)
  - `KeyHintsBar` as the bottom bar (keyboard shortcut hints)
  - `TextPanel` for room description + game log (terminal-green text)
  - `ExploringActions` for action buttons (terminal-styled `[X] Search` buttons)
  - `DPad` for directional movement (legacy characters only, already gated)
  - `TerminalModal` for ALL overlays (Inventory, Character, Store, NPC, Lore, Party, News, About, Help, Party Up)
  - `CombatPanel` renders in the right panel during combat

  The TileMap IS rendering for world characters (line ~1463) but inside the old terminal layout. Breadcrumb IS rendering (line ~1490). WorldMapView and RegionMapView ARE rendering in the right panel. RoomDetailDrawer IS rendering (uses ContextDrawer + PixelButton already).

  ### Key Branching Variable
  ```typescript
  const isWorldCharacter = !!player?.worldId;
  ```
  This already exists in the page. Use it to branch between pixel and terminal layouts.

  ### Pixel Components (all in `src/components/pixel/`)

  **HudBar** — Sprite-based status bar with PixelBadge icons
  ```tsx
  <HudBar hp={player.hp} maxHp={player.hpMax} mp={player.mp} maxMp={player.mpMax} gold={player.gold} level={player.level} />
  ```
  Props: hp, maxHp, mp, maxMp, gold, level. Renders PixelBadge components with SpriteIcon (heart, mana, coin, star).
  Currently missing: XP, companion, buffs. These need to be added.

  **PixelBadge** — Individual stat display: SpriteIcon + value text
  Types: "hp" | "mp" | "gold" | "level" | "attack" | "defense"
  Each has a configured spriteId, color, and label.

  **PixelButton** — Sprite-backed button, 4 variants:
  - `action` (green) — primary actions like Search, Attack
  - `nav` (amber) — navigation like Inventory, Shop
  - `danger` (red) — destructive like Flee, Drop
  - `info` (blue) — informational like Help, Pray
  Sizes: sm, md, lg. All have 44px min touch target on mobile.

  **PixelCard** — Container card with optional title + icon
  ```tsx
  <PixelCard title="Room Name" icon="building_shop">
    <p>Content here</p>
  </PixelCard>
  ```
  Dark gray border, gray-900 background, header bar with icon. Use for panels, info boxes.

  **ContextDrawer** — Mobile bottom sheet / desktop right panel
  ```tsx
  <ContextDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Details">
    <p>Content</p>
  </ContextDrawer>
  ```
  Mobile: slides up from bottom, max 60dvh, drag handle, swipe-to-dismiss.
  Desktop: slides in from right, 320px wide, fixed height.

  **SpriteIcon** — Renders a sprite from the sprite sheet
  ```tsx
  <SpriteIcon spriteId="ui_heart" size={16} />
  ```
  All sprite IDs defined in `src/lib/sprites.ts`.

  **TileMap** — CSS Grid tile renderer
  - Dead-zone viewport scrolling
  - Click-to-move, keyboard (WASD/arrows)
  - Background is solid `bg-[#0a0a0a]` — needs grid pattern added
  - Each tile: SpriteIcon + markers + player indicator
  - Visibility: hidden/discovered/visible CSS classes in globals.css

  **TileTooltip** — Hover/long-press info on tiles (already wired)

  **Breadcrumb** — World > Region > Area > Building navigation (already wired)

  ### Terminal Components (keep for legacy, do NOT delete)
  - `src/components/terminal/TerminalHUD.tsx` — outer shell
  - `src/components/terminal/TerminalModal.tsx` — overlay modal
  - `src/components/terminal/TerminalText.tsx` — animated text
  - `src/components/terminal/TerminalLoading.tsx` — loading spinner
  - `src/components/game/StatusBar.tsx` — ASCII status bar
  - `src/components/game/TextPanel.tsx` — room desc + game log

  ### Game Panels (content components — restyle, don't rewrite)
  - `src/components/game/CombatPanel.tsx` — combat UI with monster list, action buttons, log
  - `src/components/game/StorePanel.tsx` — buy/sell interface
  - `src/components/game/NPCDialog.tsx` — NPC conversation tree
  - `src/components/game/InventoryPanel.tsx` — item grid with equip/use/drop
  - `src/components/game/CharacterSheet.tsx` — stats display
  - `src/components/game/LorePanel.tsx` — codex entries
  - `src/components/game/PartyPanel.tsx` — companion display
  - `src/components/game/NewsPanel.tsx` — news feed
  - `src/components/game/AboutPanel.tsx` — about page
  - `src/components/game/HelpModal.tsx` — help/key reference
  - `src/components/game/DeathScreen.tsx` — death overlay
  - `src/components/game/VictoryScreen.tsx` — combat victory overlay
  - `src/components/game/LevelUpModal.tsx` — level up celebration

  ### Color Palette (pixel UI)
  - Background: `bg-gray-950` or `bg-[#0a0a0a]`
  - Card/panel: `bg-gray-900` border `border-gray-700`
  - Text primary: `text-gray-200` or `text-white`
  - Text secondary: `text-gray-400`
  - Text muted: `text-gray-500`
  - Accent colors per badge type: red-400 (HP), blue-400 (MP), amber-400 (Gold), green-400 (Level)
  - Do NOT use terminal-green, terminal-amber, terminal-border etc. for world characters

  ### Sprite IDs Available (from src/lib/sprites.ts)
  Terrain: terrain_grass, terrain_stone, terrain_dirt, terrain_water, terrain_lava, terrain_sand, terrain_snow, terrain_wall, terrain_void
  Buildings: building_tavern, building_shop, building_temple, building_castle, building_house, building_tower, building_dungeon_entrance
  Markers: marker_player, marker_npc, marker_quest, marker_campfire, marker_chest, marker_encounter, marker_entrance, marker_exit, marker_stairs_up, marker_stairs_down, marker_other_player
  HUD: ui_heart, ui_mana, ui_coin, ui_star, ui_sword, ui_shield, ui_skull, ui_potion
  Banners: banner_title, banner_subtitle
  Buttons: btn_action, btn_nav, btn_danger, btn_info, btn_disabled

  ## Tasks in order:

  1. TASK-20260308-160 — Bifurcate play page layout
     Split the main `return (...)` JSX into two paths:
     ```tsx
     if (isWorldCharacter) {
       return <PixelGameLayout ... />;
     }
     return <TerminalGameLayout ... />; // existing code
     ```
     Approach:
     - Extract the existing terminal layout (TerminalHUD + everything inside) into a `TerminalGameLayout` component or just wrap it in the else branch
     - Create the pixel layout for world characters:
       - Outer: `div.h-dvh.w-dvw.bg-gray-950.flex.flex-col` (dark background, no green borders)
       - Top: HudBar (task 2 will enhance it, for now just wire the basic version)
       - Middle: flex row — left: TileMap + Breadcrumb, right: game log + actions
       - Overlays: same overlay modals but will be restyled in task 5
     - ALL hooks must stay above both branches (they already are after the hooks fix)
     - Both layouts use the same state, mutations, handlers — only the JSX shell differs
     - Move the `isWorldCharacter` check BEFORE the early returns if needed (it's already there)
     - Keep WorldMapView and RegionMapView rendering in the right panel (both layouts)

  2. TASK-20260308-161 — Replace StatusBar with HudBar
     Enhance HudBar to show all the info StatusBar shows:
     - Add props: `name`, `className` (class name string), `xp`, `xpNext`, `companion`, `buffs`
     - Add a compact header row: `"[Name] — Lv.X [Class]"` in gray-200 text, small font
     - Add PixelBadge for XP (new badge type, purple/violet color, use ui_star sprite or add a new one)
     - Add companion HP indicator if companion exists and alive
     - Add buff indicators (shield value, blessing with remaining count)
     - HudBar layout: header row on top, badges row below, all in a `bg-black/80 border-b border-gray-700` container
     - Wire in pixel layout: replace StatusBar with enhanced HudBar

  3. TASK-20260308-162 — Add grid background to TileMap
     Make the tile grid visually distinct:
     - Add 1px `border-r border-b border-gray-800` (or `border-[#1a1a1a]`) to each TileCell div
     - This creates visible grid lines between tiles without needing CSS gradients
     - Add `border-2 border-gray-700` around the outer TileMap container
     - Hidden tiles keep the grid border but stay dark (the tile-hidden class already makes bg black)
     - Alternatively use `outline: 1px solid #1a1a1a` on each tile to avoid affecting tile sizing
     - Ensure tiles still render at exact tileSize (borders shouldn't push layout — use `box-sizing: border-box` or outline)
     - Test that viewport scrolling still works correctly after adding borders

  4. TASK-20260308-163 — Replace action buttons with PixelButton bar
     For world characters, replace ExploringActions with pixel-styled action bar:
     - Create `PixelActionBar` component (or inline in pixel layout)
     - Two rows or groups:
       - **Context actions** (based on room type): Search, Rest, Pray, Talk, Shop — use `variant="action"` or appropriate
       - **Menu actions**: Inventory, Character, Codex, Party, News, About, Help, Exit — use `variant="nav"`
     - Each button: `<PixelButton variant="action" size="sm" onClick={() => handleAction("search")}>Search</PixelButton>`
     - Compact flex-wrap layout, gap-2
     - Keep keyboard shortcuts working (they're handled by the root onKeyDown, not the buttons)
     - On mobile: buttons should wrap and fill width, 44px touch targets (already built into PixelButton)
     - KeyHintsBar: hide for world characters (or show a simpler version with just key letters)

  5. TASK-20260308-164 — Convert overlay panels to pixel-styled modals
     Create a `PixelModal` component (reusable):
     ```tsx
     interface PixelModalProps {
       open: boolean;
       onClose: () => void;
       title: string;
       icon?: SpriteId;
       className?: string;
       children: React.ReactNode;
     }
     ```
     - Renders a centered overlay with backdrop (similar to TerminalModal but pixel-styled)
     - Container: PixelCard with close button (X in top-right)
     - Backdrop: `bg-black/60` with click-to-close
     - Max-height: `max-h-[85dvh]`, overflow-y-auto on content
     - Escape key closes
     - On mobile: could be full-width bottom sheet style, or centered modal — pick whichever works better

     Replace all `<TerminalModal>` wrappers in the pixel layout with `<PixelModal>`:
     - Inventory: icon="ui_sword", title="Inventory"
     - Character: icon="ui_shield", title="Character"
     - Store: icon="building_shop", title={storeName}
     - NPC: icon="marker_npc", title={npcName}
     - Lore: icon="ui_star", title="Codex"
     - Party: icon="marker_player", title="Party"
     - News: no icon change needed
     - About: no icon change needed
     - Help: icon="ui_potion", title="Help"
     - Party Up: icon="marker_npc", title="Adventurer Encountered"

     For the content INSIDE the modals — leave mostly as-is for now. The TerminalModal → PixelModal wrapper swap is the main visual change. If inner components use `text-terminal-green` heavily, consider adding a `className` prop or CSS override, but don't rewrite the component internals.

  6. TASK-20260308-165 — Pixel-style combat panel
     For world characters, create or modify CombatPanel to use pixel styling:
     - Read existing CombatPanel.tsx to understand its structure
     - Option A: Add an `isPixelMode` prop to CombatPanel that switches styling
     - Option B: Create a `PixelCombatPanel` wrapper that reskins the output
     - Option A is simpler — go with that unless CombatPanel is too entangled with terminal classes

     Changes for pixel mode:
     - Monster info: PixelCard with monster name, HP bar (use PixelBadge or custom bar)
     - Combat actions: PixelButton row — Attack (action), Defend (info), Cast (nav), Flee (danger), Use Item (nav)
     - Combat log: scrollable div with gray-300 text, no terminal-green
     - Player stats during combat: PixelBadge for HP/MP
     - Layout: if map is visible above, combat panel fills remaining space below

     In the pixel layout's JSX, when `inCombat && combatState`:
     - Map stays visible but shrunk (max-h-[20dvh] already exists)
     - Combat panel renders below map, filling remaining space

  7. TASK-20260308-166 — Game log / text panel pixel conversion
     For world characters, replace TextPanel with a pixel-styled info panel:
     - Top section: Room info in a PixelCard
       - Title: room.name with SpriteIcon for room type (use ROOM_TYPE_ICON map from RoomDetailDrawer)
       - Body: room.description in gray-300 text
       - Exits: show as small badges or directional text
       - Room features: campfire/altar/trap badges (like RoomDetailDrawer already does)
     - Bottom section: Scrollable game log
       - Each entry as a line in gray-400 text
       - Most recent at bottom, auto-scroll
       - Combat-related entries could be highlighted (red for damage, green for healing)
     - Loading state: "Exploring..." with pulse animation, matching existing loading-overlay style
     - Keep the TerminalText animated typing for legacy characters only

  8. TASK-20260308-167 — Responsive design and final polish
     Test and fix layout at all breakpoints:
     - **Mobile (< 768px)**:
       - Stack vertically: HudBar → TileMap (60-70% height) → Breadcrumb → compact action bar → game log (scrollable)
       - Overlays: full-width, maybe bottom-sheet style
       - TileMap: tiles should be large enough to tap (32px minimum, ideally 40px on small screens)
       - Action bar: compact, wrapping flex with small buttons
     - **Desktop (>= 768px)**:
       - HudBar full width at top
       - Below: flex-row — Left 40%: TileMap + Breadcrumb, Right 60%: game log + actions
       - ContextDrawer slides in from right on room click, pushes/overlays the right panel
       - Overlays: centered modal with max-width
     - **Widescreen (>= 1400px)**:
       - Cap content at 1400px, center on screen (already has `max-w-[1400px]`)
     - All click/tap targets: 44px minimum (PixelButton already handles this)
     - Verify: `pnpm typecheck` passes, `pnpm build` succeeds
     - Test: create character → world map → region → area → move → combat → store → NPC → inventory → death → respawn
     - Fix any broken flows or visual issues found during testing

  ## Critical Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.
  - Do NOT delete terminal components — they're still used by legacy characters AND by other pages (admin panel, landing page, character creation).
  - Do NOT change game logic, tRPC routers, or database schema. This is a pure UI/frontend sprint.
  - Do NOT break legacy character flow. Legacy characters must still work with the terminal UI.
  - All hooks must be called unconditionally (above any early returns). The play page had a hooks ordering bug that was recently fixed — don't reintroduce it.
  - Keep the same handlers, mutations, queries — only change the JSX layout/wrappers.
  - The page is ~1780 lines. Consider extracting the pixel layout into a separate component file if it gets unwieldy (e.g., `src/components/game/PixelGameLayout.tsx`), but keep all hooks in the page component since they can't be split.
  - Prefer editing existing components (add isPixelMode/variant props) over creating duplicate components.
  - Mobile-first: design for 320px width first, enhance for desktop.
