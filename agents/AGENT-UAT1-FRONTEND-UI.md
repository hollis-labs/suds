Frontend Agent (UAT Iteration 1 — Layout & UX Fixes):

  You are working sprint SPR-20260308-uat-iteration-1 (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint fixes UI layout issues and UX improvements based on playtesting feedback. All tasks are frontend-only.

  ## Color Palette (use these consistently)

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

  ## Key Files

  - `src/app/(game)/play/[characterId]/page.tsx` — Main play page (~2000 lines). The pixel layout branch (`isWorldCharacter`) is what you modify.
  - `src/components/game/DungeonMap.tsx` — Dungeon map renderer
  - `src/components/game/MiniMap.tsx` — Mini map overlay
  - `src/components/game/RoomInfoPanel.tsx` — Room info + game log panel
  - `src/components/pixel/HudBar.tsx` — Top status bar

  ## Current Layout Structure (Desktop)

  ```
  ┌──────────────────────────────────────────────────┐
  │ HudBar (full width)                              │
  ├──────────┬───────────────────────┬───────────────┤
  │ Map Col  │ Center: RoomInfoPanel │ Right Sidebar │
  │ (30% xl) │ + Log + Actions       │ (180px, xl)   │
  │          │                       │ Actions/DPad  │
  └──────────┴───────────────────────┴───────────────┘
  ```

  ## Tasks in order:

  1. TASK-20260308-189 — Fix reversed directional controls

     **Symptom**: Pressing up/W moves the character down on the map. All directions are reversed.

     **DungeonMap coordinate system** (`src/components/game/DungeonMap.tsx`):
     - Room positions: `top: cell.y * CELL_H` — so y=0 is at the TOP of the screen
     - Adjacency check (lines 249-252): north → ny = y-1, south → ny = y+1

     **Server coordinate system** (`src/server/trpc/routers/game.ts`):
     - When the server processes a "north" move, check what happens to the y coordinate
     - The bug is likely that the server uses y-increasing-upward (math convention) while the renderer uses y-increasing-downward (screen convention)

     **Where to look**:
     - Keyboard handler in play page: find where arrow keys / WASD map to direction strings ("north", "south", "east", "west")
     - DPad component (defined inline in play page, lines 64-152): maps button presses to `onMove("north")` etc.
     - The `moveMutation` handler: what direction string gets sent to the server
     - `src/server/game/` — check how the server resolves "north" to a y-coordinate change

     **Fix approach**: Either:
     - A) Fix the DungeonMap to render y=0 at bottom (flip the visual) — simplest if server uses y-up
     - B) Fix the server to use y-down convention — riskier, touches game logic
     - C) Swap the direction mapping in the keyboard/DPad handlers — quickest hack but wrong

     Option A is preferred: in DungeonMap.tsx, if the server treats north as y+1 (up in its coordinate space), then the renderer should show higher y values at the top. Investigate the server's coordinate system first before choosing.

     **Acceptance criteria**: Up arrow/W moves character visually upward on map (north). Down/S moves visually downward (south). Left/A = west. Right/D = east. Both keyboard and DPad.

  2. TASK-20260308-182 — Improve activity log formatting

     **Symptom**: The activity/game log shows lines with numbers that aren't clearly attributed. Hard to tell whose turn it is.

     **Current rendering** (`src/components/game/RoomInfoPanel.tsx`, lines 163-190):
     - Game log entries are plain strings from `gameLog` array
     - Displayed with a chevron (`›`) prefix and the text
     - Latest entry highlighted in white/amber, older in dim green

     **Fix**:
     - Parse each log entry string for actor attribution. Log entries from the server typically contain patterns like "You attack...", "Goblin attacks...", "Companion Name attacks..."
     - Add icons/markers before each entry based on the actor:
       - Player actions: green `@` or sword icon
       - Monster actions: red `x` or skull
       - Companion actions: blue `&` or shield
       - System/narrative: dim `›` (current default)
     - Use simple string matching: entries starting with "You " = player, entries containing monster names or "Enemy " = monster, entries containing companion name = companion
     - Bold the actor name/pronoun at the start of each line
     - Color the entire line by actor type (green for player, red for monster damage, blue for companion)
     - Remove or replace any raw numbers that don't have context

     **Also check** `src/components/game/CombatPanel.tsx` — the combat panel has its own log rendering. Apply the same formatting there.

     **Acceptance criteria**: Each log entry is clearly attributable with an icon + color coding. No unexplained raw numbers.

  3. TASK-20260308-184 — HUD bar always shows full stats

     **Current HudBar** (`src/components/pixel/HudBar.tsx`):
     Props it accepts: hp, maxHp, mp, maxMp, gold, level, name, characterClass, xp, xpNext, companion, buffs

     **What's missing vs the original StatusBar** (`src/components/game/StatusBar.tsx`):
     - **Equipped weapon name** and **equipped armor name** — the original StatusBar showed these
     - **XP progress bar** — HudBar shows XP as a number badge but not as a visual bar like HP/MP

     **Fix**:
     - Add props to HudBar: `weapon?: string`, `armor?: string`
     - Display equipped items compactly: weapon icon + name, armor icon + name (use small text, inline with other badges)
     - Add an XP progress bar similar to HP/MP bars (purple/violet color)
     - Check how the play page passes props to HudBar and add the missing weapon/armor/xp data
     - On mobile: show HP, MP, gold on first row. Level, XP, equipment on second row (compact)
     - On desktop: all on one or two rows with enough space

     **Acceptance criteria**: HudBar shows HP bar, MP bar, XP bar, gold, level, equipped weapon name, equipped armor name. Visible at all breakpoints.

  4. TASK-20260308-185 — Resize map: 50% wider, 50% shorter

     **Current**: The DungeonMap container takes a percentage of the layout width and has flexible height.

     **Change**:
     - Make the map container wider — increase its width allocation by 50% (e.g., if it's 30% on desktop, try 45%)
     - Make the map container shorter — reduce its height by 50% (e.g., if it fills available vertical space, cap it at something like `max-h-[35vh]` or `max-h-[300px]`)
     - This creates a landscape/wide aspect ratio for the map
     - The freed vertical space below the map is where DPad and content will go
     - Rooms and corridors should still render correctly within the new dimensions
     - Scrolling within the map container should still work
     - On mobile (map tab): the map should still fill available width but be shorter

     **Files**: `src/app/(game)/play/[characterId]/page.tsx` (container sizing), `src/components/game/DungeonMap.tsx` (internal layout if needed)

     **Acceptance criteria**: Map is noticeably wider and shorter. Rooms/corridors render correctly. Scrolling works.

  5. TASK-20260308-186 — Minimap toggle with keyboard shortcut

     **Current**: MiniMap is positioned `absolute top-2 right-2 z-20 hidden md:block` in the map column.

     **Changes**:
     - Inset the minimap slightly more from the corner: `top-3 right-3` or `top-4 right-4`
     - Add a toggle state: `const [minimapOpen, setMinimapOpen] = useState(true)`
     - When minimapOpen=true: show the full minimap (current behavior)
     - When minimapOpen=false: show a small icon button (like a map pin or grid icon) in the same position
     - Clicking the minimap → collapses to icon (setMinimapOpen(false))
     - Clicking the icon → restores minimap (setMinimapOpen(true))
     - Add keyboard shortcut: `M` key toggles the minimap (add to the existing keyboard handler)
       - BUT: M key currently does something else (world map toggle?) — check first. If so, use a different key like `,` or `.` or make M context-dependent
     - The toggle icon when collapsed: a small square with a grid/map symbol, styled with the green palette

     **Files**: `src/app/(game)/play/[characterId]/page.tsx` (state + keyboard handler), `src/components/game/MiniMap.tsx` (optional: add collapse click handler)

     **Acceptance criteria**: Click minimap → collapses to icon. Click icon → restores. Keyboard shortcut works. Inset from corner.

  6. TASK-20260308-187 — Remove right rail, move DPad below map

     **Current desktop layout** (xl breakpoint): 3 columns — Map (30%) | Center (flex-1) | Right sidebar (180px w-[180px])

     **New layout**: Remove the third column entirely. The layout becomes:
     ```
     ┌──────────────────────────────────────────────┐
     │ HudBar (full width)                          │
     ├──────────────────────────────────────────────┤
     │ Map (wider now, per task 4)                  │
     │ [MiniMap overlay top-right]                  │
     ├──────────────────────────────────────────────┤
     │ DPad (centered, horizontal)                  │
     ├──────────────────────────────────────────────┤
     │ Panel buttons (Inv, Char, Codex, etc.)       │
     ├──────────────────────────────────────────────┤
     │ Activity Feed / Game Log                     │
     ├──────────────────────────────────────────────┤
     │ Action buttons (Search, Rest, Attack, etc.)  │
     └──────────────────────────────────────────────┘
     ```

     **Steps**:
     - Remove the `hidden xl:flex xl:flex-col xl:w-[180px]` sidebar div entirely (lines ~1806-1876 area)
     - Remove the `xl:hidden` classes from the center content buttons (they were hidden on xl because the sidebar showed them)
     - Place DPad directly below the map container, centered, visible at all breakpoints
     - The DPad should be compact/horizontal on desktop (not taking too much vertical space)

     **Files**: `src/app/(game)/play/[characterId]/page.tsx`

     **Acceptance criteria**: No right rail on any breakpoint. DPad below the map. Layout is single-column below the map.

  7. TASK-20260308-188 — Reorder: actions below activity feed, panels above it

     **Current order** (after removing right rail): buttons are mixed together.

     **New order**:
     ```
     [Panel buttons: Inventory, Character, Codex, Party, News, About, Help, Exit]
     [Activity Feed / Game Log - scrollable]
     [Action buttons: Search, Rest, Shrine, Talk, Shop, Attack, Flee, etc.]
     ```

     **Rationale**: Panel buttons open overlays (don't produce log output), so they go above. Action buttons (Search, Rest, Attack) produce log entries, so they sit right below the log where their output appears.

     **Implementation**:
     - Split the current button bar into two groups:
       - **Panel group** (top): [I] Inventory, [C] Character, [L] Codex, [P] Party, [N] News, [~] About, [?] Help, [Q] Exit
       - **Action group** (bottom): [X] Search, [R] Rest, [F] Shrine, [T] Talk, [B] Shop (context-dependent)
     - Panel group renders above RoomInfoPanel/game log
     - Action group renders below the game log
     - Both groups: flex-wrap, centered, gap-1.5, with keyboard badges
     - On mobile tabs: same ordering within the Room tab

     **Files**: `src/app/(game)/play/[characterId]/page.tsx`

     **Acceptance criteria**: Panel buttons above the activity feed. Action buttons below. Clear visual separation.

  ## Critical Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, do NOT close the sprint (other tasks may remain for a backend agent).
  - Do NOT modify legacy character layout (the `!isWorldCharacter` branch).
  - Do NOT change game logic, tRPC routers, or database schema. Frontend only.
  - Do NOT delete any existing components — only modify or add.
  - All hooks must remain above early returns in the play page (hooks ordering rule).
  - Use the green terminal palette for ALL new UI. No blue/gray.
  - Use JetBrains Mono or `font-mono` for game text.
  - `text-shadow: 0 0 8px rgba(51, 255, 51, 0.4)` for terminal glow on important green text.
