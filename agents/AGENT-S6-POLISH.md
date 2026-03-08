Fullstack Agent (S6 polish & integration):

  You are working sprint SPR-20260308-world-redesign-s6-polish (project_id: suds-v2). Your working directory is ~/Projects-apps/suds-v2/. Only modify files in
  THIS repo.

  IMPORTANT: Only modify files in ~/Projects-apps/suds-v2/. Do NOT touch other repos.

  This sprint polishes the world navigation system built in S3-S5. It focuses on animations, responsive layout, combat/store/NPC integration, loading states, performance, and cross-device testing. The core infrastructure is complete — this sprint makes it production-ready.

  ## What Already Exists (Sprints 1-5 + Quickfix)

  ### Navigation System (fully wired)
  - `src/components/game/WorldMapView.tsx` — pick-and-go region selection, rendered when screen === "world_map"
  - `src/components/game/RegionMapView.tsx` — pick-and-go area selection, rendered when screen === "region_map"
  - `src/components/game/RoomDetailDrawer.tsx` — room interactions in ContextDrawer
  - `src/components/pixel/TileMap.tsx` — CSS Grid tile renderer with click-to-move, fog of war, viewport scrolling
  - `src/components/pixel/TileTooltip.tsx` — hover/long-press tile info
  - `src/components/pixel/Breadcrumb.tsx` — hierarchy navigation (wired, displays for world characters)
  - `src/components/pixel/ContextDrawer.tsx` — right panel desktop, bottom sheet mobile
  - `src/components/pixel/HudBar.tsx` — HP/MP/Gold/Level badges
  - `src/components/pixel/PixelButton.tsx` — 4 variants (action/nav/danger/info)
  - `src/components/pixel/PixelCard.tsx` — styled container

  ### Backend
  - 7 navigation tRPC endpoints: getWorldMap, getRegionMap, travelToRegion, travelToArea, enterBuilding, exitBuilding, changeFloor
  - `src/server/game/navigation.ts` — navigation logic with fog_of_war discovery
  - World gen pipeline: region/area/building generators in `src/server/game/world-gen/`
  - Content library with template-first lookup
  - Characters table has: worldId (nullable), currentFloor (nullable)
  - Rooms table has hierarchy columns: worldId, regionId, areaId, buildingId, floor

  ### Game Page (`src/app/(game)/play/[characterId]/page.tsx`)
  - Renders WorldMapView, RegionMapView, or TileMap based on screen + navigationLayer
  - Legacy characters (worldId === null) use old MapPanel
  - navigationLayer tracked in gameStore: "world" | "region" | "area" | "building"
  - navigationNames tracked for Breadcrumb labels
  - handleTileClick: current tile → drawer, adjacent → move, non-adjacent → feedback
  - Keyboard: WASD/arrows for movement, various shortcuts for actions

  ### Existing Game Components (need integration work)
  - `src/components/game/CombatPanel.tsx` — combat UI (currently full-screen on right panel)
  - `src/components/game/StorePanel.tsx` — store buy/sell UI (currently full-screen overlay)
  - `src/components/game/NPCDialog.tsx` — NPC conversation UI (currently full-screen overlay)
  - `src/components/terminal/TerminalLoading.tsx` — loading indicator reference

  ### Key Types
  - `GameState.screen`: "exploring" | "combat" | "store" | "npc" | "inventory" | "character" | "death" | "level_up" | "lore" | "party" | "news" | "about" | "world_map" | "region_map"
  - `NavigationLayer`: "world" | "region" | "area" | "building"
  - `HierarchicalPosition`: { worldId, regionId, areaId, buildingId?, floor?, x, y }
  - Legacy check: `const isWorldCharacter = !!player?.worldId`

  ## Tasks in order:

  1. TASK-20260308-092 — Layer transition animations
     Add smooth CSS transitions when navigating between hierarchy layers:
     - World → Region (zoom in): region node scales up, region map fades in. 300ms.
     - Region → Area (zoom in): area icon scales up, tile grid fades in. 300ms.
     - Area → Building (enter): brief overlay, interior fades in. 200ms.
     - Any layer up (zoom out): current view scales down, parent fades in. 300ms.
     - Floor transition: vertical slide (down for descending, up ascending). 200ms.
     - Use CSS transitions with state-driven classes (not a heavy animation library).
     - Keep animations SHORT (200-300ms) — players navigate frequently.
     - Respect `prefers-reduced-motion` media query — skip animations when set.
     - Files: game page, WorldMapView, RegionMapView, globals.css

  2. TASK-20260308-093 — Mobile layout optimization
     Mobile is the primary platform. Optimize for touch:
     - Map viewport: 70%+ of screen height. TileMap fills available width, tiles scale to fit.
     - HudBar: compact mode on small screens — icons + numbers only, no labels.
     - Breadcrumb: horizontally scrollable on overflow, smaller font on mobile.
     - ContextDrawer: bottom sheet on mobile, max 60vh. Drag handle for swipe-to-dismiss.
     - Action buttons: minimum 44x44px touch targets, 8px+ gaps.
     - Combat panel: full-width below a shrunk map (map stays visible).
     - No hover states on mobile — use active/pressed states.
     - Test breakpoints: 320px, 375px, 414px, 768px+.
     - No horizontal overflow at 320px width.
     - Files: game page, HudBar, ContextDrawer, Breadcrumb

  3. TASK-20260308-094 — Loading states for world generation
     AI generation takes 2-5 seconds — players need feedback:
     - Entering new area: "Exploring [area name]..." with pulsing animation
     - Entering building: "Entering [building name]..." overlay on entrance tile
     - Room generation: skeleton tiles with shimmer/pulse where rooms will appear
     - Floor transition: "Descending to Floor X..." with brief animation
     - AI content: "The world takes shape..." flavor text
     - Timeout: if > 10 seconds, show "Taking longer than expected..."
     - Pre-generation: when player is within 2 tiles of unexplored area, pre-fetch adjacent rooms in background
     - Reference: TerminalLoading.tsx for existing loading patterns
     - Files: TileMap, game page

  4. TASK-20260308-095 — Desktop layout refinement
     Optimize for desktop (>= 768px):
     - Side-by-side: Map (70%) + ContextDrawer (30%) when drawer is open
     - Map stays fully interactive with drawer open (player can move while reading details)
     - Keyboard shortcuts: M=world map, I=inventory, C=character, Esc=close drawer/go back, Tab=cycle actions
     - Hover tooltips on tiles (already built in TileTooltip)
     - Widescreen (> 1400px): cap game area width and center, prevent over-stretch
     - Files: game page, ContextDrawer, useKeyboard

  5. TASK-20260308-096 — Combat integration with new map system
     Ensure combat works with tile map and hierarchy:
     - Combat trigger: moving to encounter tile starts combat as before. Encounter marker shown on tile before entry.
     - During combat: map partially visible (shrunk or behind combat panel). Player can see their location.
     - Post-combat: return to map view. Loot appears in ContextDrawer (not full-screen). Encounter marker removed from tile.
     - Death/respawn: if lastSafe uses hierarchy format, respawn at correct world/region/area/building/floor. Legacy lastSafe stays as {x, y}.
     - Flee: player stays on same tile, encounter regenerated with cooldown. Can move away safely.
     - Boss encounters: boss room tiles get skull/boss marker. Boss rooms at depth >= 8 (existing logic).
     - NO changes to core combat logic in combat.ts — only integration/UI changes.
     - Files: game page, CombatPanel, combat.ts router

  6. TASK-20260308-097 — Store and NPC integration with new map system
     Ensure stores and NPCs work in ContextDrawer:
     - Store: entering store tile/building opens StorePanel within ContextDrawer. Buy/sell flow works within drawer width.
     - NPC: entering NPC room auto-opens ContextDrawer with NPCDialog. Quest accept/complete within drawer.
     - Both panels currently expect full-screen width — need responsive adjustments for 300-350px drawer (desktop) and full-width bottom sheet (mobile).
     - Shared stores/NPCs: in new system, stores/NPCs belong to buildings/areas (not characters). Per-character stores still work for legacy.
     - NPC quest markers show on area map tiles.
     - Files: StorePanel, NPCDialog, ContextDrawer, store.ts router

  7. TASK-20260308-098 — Performance optimization pass
     Profile and optimize:
     - Only render tiles within viewport (no DOM nodes for off-screen tiles)
     - Memoize tile components with React.memo + shallow compare on TileData
     - Cache TileMapData conversion from room data (only reconvert when rooms change)
     - Lazy load sprite sheets, ensure browser caching
     - Batch fog_of_war inserts for multi-tile discovery
     - Test CSS filter performance (brightness/saturate) — if slow on many tiles, use opacity-only fallback
     - Use React DevTools Profiler to find unnecessary re-renders
     - Target: 60fps scrolling, <16ms per frame during movement
     - Test with 100+ discovered tiles
     - Files: TileMap, tile-types.ts

  8. TASK-20260308-099 — Cross-device testing pass
     Test all flows on:
     - iPhone Safari (iOS 16+), Android Chrome, Desktop Chrome/Firefox/Safari
     - Scenarios: create character → world map → region → area → building → dungeon → combat → death → respawn
     - Store/NPC interaction in drawer
     - Breadcrumb navigation through all layers
     - Mobile: 44px+ tap targets, drawer swipe dismiss, no accidental taps
     - Desktop: keyboard shortcuts, hover tooltips, side panel
     - Slow network: loading states appear, no broken states
     - Document bugs found as new tasks. Fix critical issues (broken flows, unresponsive UI) within this task.
     - Files: all pixel components, game page

  ## Rules:
  - Use volon_task_transition to move each task to "doing" before starting and "done" when complete. If blocked, transition to "blocked" with a reason.
  - Do NOT skip ahead. Finish and transition each task before starting the next.
  - Run `pnpm typecheck` after each task.
  - Commit after each task with a descriptive message.
  - When all tasks are done, update the sprint status to "closed" via volon_sprint_update.
  - Do NOT break existing game functionality for legacy characters.
  - Keep animations short (200-300ms). Players navigate frequently — long animations get annoying.
  - Mobile-first: design for 320px width first, enhance for desktop.
  - ContextDrawer is the universal detail panel — stores, NPCs, room details, loot all render inside it. Combat is the exception (stays full panel).
  - Performance: measure before optimizing. Use React Profiler and Chrome Performance tab to find actual bottlenecks.
