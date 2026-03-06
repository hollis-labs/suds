# SUDS v2 - Sprint Tracker

## Sprint 1: Project Scaffold & Terminal UI Foundation
Status: IN PROGRESS

### Tasks
- [x] 1.1 Initialize Next.js project with all deps
- [x] 1.2 Git repo init, CLAUDE.md, docs
- [ ] 1.3 Drizzle schema + DB connection module
- [ ] 1.4 Global CSS + terminal theme + fonts
- [ ] 1.5 Base layout (root layout, terminal chrome)
- [ ] 1.6 Terminal UI components (Terminal, TerminalText, TerminalModal, TerminalInput, TerminalHUD)
- [ ] 1.7 NextAuth configuration (providers, session)
- [ ] 1.8 tRPC setup (router, context, client)
- [ ] 1.9 Zustand game store skeleton
- [ ] 1.10 Game constants + config
- [ ] 1.11 Static gamedata JSON files (monsters, items, rooms, names, themes)
- [ ] 1.12 Vitest config + first tests
- [ ] 1.13 Landing page (terminal-styled)

---

## Sprint 2: Auth & Character Creation
Status: NOT STARTED

### Tasks
- [ ] 2.1 Invite system (table, validation, middleware)
- [ ] 2.2 Auth pages (login, invite code entry)
- [ ] 2.3 Character list page
- [ ] 2.4 Character creation wizard (4-step)
- [ ] 2.5 Character CRUD tRPC routes
- [ ] 2.6 Class definitions + starting stats
- [ ] 2.7 Starting room generation (origin 0,0)
- [ ] 2.8 Tests for auth + character flows

---

## Sprint 3: World & Exploration
Status: NOT STARTED

### Tasks
- [ ] 3.1 Room generation algorithm (server/game/world.ts)
- [ ] 3.2 Dice rolling utilities (server/game/dice.ts)
- [ ] 3.3 Map viewport algorithm (server/game/map.ts)
- [ ] 3.4 game.move tRPC route
- [ ] 3.5 game.getMap tRPC route
- [ ] 3.6 game.searchRoom tRPC route
- [ ] 3.7 Main game layout component
- [ ] 3.8 Map component (ASCII grid, fog of war, viewport)
- [ ] 3.9 TextPanel component (room descriptions, typing effect)
- [ ] 3.10 StatusBar component (HP/MP/Gold/XP)
- [ ] 3.11 Action bar + keyboard handler
- [ ] 3.12 Zustand game store integration
- [ ] 3.13 Tests for world generation + movement

---

## Sprint 4: Combat System
Status: NOT STARTED

### Tasks
- [ ] 4.1 Combat engine (server/game/combat.ts)
- [ ] 4.2 Monster generation from gamedata
- [ ] 4.3 Loot system (server/game/loot.ts)
- [ ] 4.4 combat tRPC routes (getState, action)
- [ ] 4.5 Leveling system (server/game/player.ts)
- [ ] 4.6 Death/respawn logic
- [ ] 4.7 CombatPanel component
- [ ] 4.8 Level-up modal
- [ ] 4.9 Death/respawn screen
- [ ] 4.10 Tests for combat + leveling

---

## Sprint 5: Stores, NPCs & Inventory
Status: NOT STARTED

### Tasks
- [ ] 5.1 Store engine (server/game/store.ts)
- [ ] 5.2 NPC engine (server/game/npc.ts)
- [ ] 5.3 Store tRPC routes
- [ ] 5.4 NPC tRPC routes
- [ ] 5.5 StorePanel component
- [ ] 5.6 NPCDialog component
- [ ] 5.7 InventoryPanel component
- [ ] 5.8 CharacterSheet component
- [ ] 5.9 Player base + fast travel
- [ ] 5.10 Tests for stores, NPCs, inventory

---

## Sprint 6: Polish & Launch Prep
Status: NOT STARTED

### Tasks
- [ ] 6.1 Map viewport transitions + animations
- [ ] 6.2 Combat animations
- [ ] 6.3 Loading states + error handling
- [ ] 6.4 Responsive layout
- [ ] 6.5 Terminal color theme selector
- [ ] 6.6 Game balance tuning
- [ ] 6.7 Admin page (invite codes, user list)
- [ ] 6.8 Content safety filtering
- [ ] 6.9 E2E tests with Playwright
- [ ] 6.10 Build verification + deployment config
