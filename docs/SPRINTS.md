# SUDS v2 - Sprint Tracker

## Sprint 1: Project Scaffold & Terminal UI Foundation
Status: COMPLETE

### Tasks
- [x] 1.1 Initialize Next.js 15 project with TypeScript, Tailwind CSS 4, App Router
- [x] 1.2 Git repo init, CLAUDE.md, docs (PRD, SPEC, PLAN, ADR-001)
- [x] 1.3 Drizzle ORM schema + PostgreSQL connection module
- [x] 1.4 Global CSS + terminal theme (monospace fonts, dark palette, scanlines, glow)
- [x] 1.5 Base layout (root layout, terminal chrome container)
- [x] 1.6 Terminal UI components (Terminal, TerminalText, TerminalModal, TerminalInput, TerminalHUD)
- [x] 1.7 NextAuth.js v5 configuration (Google, GitHub, Discord providers)
- [x] 1.8 tRPC setup (router, context, client integration with App Router)
- [x] 1.9 Zustand game store skeleton
- [x] 1.10 Game constants + config (GAME_CONFIG with tunable values)
- [x] 1.11 Static gamedata JSON files (monsters, items, rooms, names, themes)
- [x] 1.12 Vitest config + first tests
- [x] 1.13 Landing page (terminal-styled)

---

## Sprint 2: Auth & Character Creation
Status: COMPLETE

### Tasks
- [x] 2.1 Invite system (invites table, code validation, middleware)
- [x] 2.2 Auth pages (login, invite code entry)
- [x] 2.3 Character list page
- [x] 2.4 Character creation wizard (4-step: name, class, theme, confirm)
- [x] 2.5 Character CRUD tRPC routes (list, create, delete, get)
- [x] 2.6 Class definitions + starting stats (Warrior, Mage, Rogue, Cleric)
- [x] 2.7 Starting room generation (origin 0,0)
- [x] 2.8 Tests for auth + character flows

---

## Sprint 3: World & Exploration
Status: COMPLETE

### Tasks
- [x] 3.1 Room generation algorithm (server/game/world.ts) — type selection weighted by depth, exit generation, descriptions
- [x] 3.2 Dice rolling utilities (server/game/dice.ts)
- [x] 3.3 Map viewport algorithm (server/game/map.ts) — 15x11 viewport, dead zone, edge detection, fog of war
- [x] 3.4 game.move tRPC route — direction validation, room generation, encounter checks
- [x] 3.5 game.getMap tRPC route — viewport computation, explored rooms
- [x] 3.6 game.searchRoom tRPC route — INT/WIS checks, hidden items
- [x] 3.7 Main game layout component (map + text + status + actions)
- [x] 3.8 Map component (ASCII grid, fog of war, viewport sliding)
- [x] 3.9 TextPanel component (room descriptions, typing effect)
- [x] 3.10 StatusBar component (HP/MP/Gold/XP bars)
- [x] 3.11 Action bar + keyboard handler (WASD/arrow keys, search, inventory)
- [x] 3.12 Zustand game store integration (hydration from tRPC responses)
- [x] 3.13 Tests for world generation + movement

---

## Sprint 4: Combat System
Status: COMPLETE

### Tasks
- [x] 4.1 Combat engine (server/game/combat.ts) — initiative, turn order, attack/defend/cast/flee resolution
- [x] 4.2 Monster generation from gamedata tables
- [x] 4.3 Loot system (server/game/loot.ts) — loot tables, rarity distribution, item generation
- [x] 4.4 Combat tRPC routes (getState, action, resolve)
- [x] 4.5 Leveling system (server/game/player.ts) — XP thresholds, stat increases, HP rolls, ability unlocks
- [x] 4.6 Death/respawn logic — respawn at last safe room, 25% gold penalty
- [x] 4.7 CombatPanel component — monster display, turn order, action menu, combat log
- [x] 4.8 Level-up modal with stat changes
- [x] 4.9 Death/respawn screen
- [x] 4.10 Tests for combat + leveling

---

## Sprint 5: Stores, NPCs & Inventory
Status: COMPLETE

### Tasks
- [x] 5.1 Store engine (server/game/store.ts) — inventory by depth/level, pricing, CHA discounts
- [x] 5.2 NPC engine (server/game/npc.ts) — generation, dialogue trees, personality
- [x] 5.3 Store tRPC routes (getInventory, buy, sell)
- [x] 5.4 NPC tRPC routes (talk, getQuests)
- [x] 5.5 StorePanel component — item list, buy/sell tabs, gold display, rarity coloring
- [x] 5.6 NPCDialog component — dialogue text, typing effect, numbered choices
- [x] 5.7 InventoryPanel component — grid slots, equip/unequip, use consumables
- [x] 5.8 CharacterSheet component — full stats, equipment slots, abilities
- [x] 5.9 Player base + fast travel to base
- [x] 5.10 Tests for stores, NPCs, inventory

---

## Sprint 6: Polish & Launch Prep
Status: COMPLETE

### Tasks
- [x] 6.1 Map viewport transitions + CSS animations (smooth slide, player highlight)
- [x] 6.2 Combat animations (shake, flash-red, flash-green keyframes)
- [x] 6.3 Loading states (TerminalLoading spinner) + error handling (TerminalError)
- [x] 6.4 Responsive layout (stacked mobile, scrollable action bar)
- [x] 6.5 Terminal color theme selector (green/amber/white with localStorage)
- [x] 6.6 Game balance via GAME_CONFIG tunable constants
- [x] 6.7 Admin page (stats, invite generation, user list, invite list)
- [x] 6.8 Content safety filtering (validateContent, validateCharacterName, sanitizeAIContent)
- [x] 6.9 E2E tests deferred (needs running instance) — documented in BLOCKERS.md
- [x] 6.10 Build verification: Dockerfile, .do/app.yaml, standalone output, CI workflow
- [x] 6.11 ADRs (001-005) and documentation finalization (SPRINTS, BLOCKERS)
