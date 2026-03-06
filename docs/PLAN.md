# SUDS v2 - Implementation Plan

## Phase 0: Project Scaffold (Sprint 1)

### 0.1 Initialize Project
- [ ] `create-next-app` with TypeScript, Tailwind, App Router
- [ ] Configure Tailwind with terminal theme (monospace fonts, dark palette)
- [ ] Install and configure Shadcn/ui with custom terminal theme
- [ ] Set up Drizzle ORM + PostgreSQL connection
- [ ] Set up tRPC with Next.js App Router integration
- [ ] Set up NextAuth.js v5 with Google + GitHub + Discord providers
- [ ] Create base layout with terminal chrome (scanlines, border, glow)
- [ ] ESLint + Prettier config
- [ ] Git repo init, CLAUDE.md, README

### 0.2 Database Schema
- [ ] Create Drizzle schema for all MVP tables (users, characters, rooms, etc.)
- [ ] Generate and run initial migration
- [ ] Seed marketplace_items with starter data
- [ ] Set up static gamedata JSON files (monsters, items, rooms, names, themes)

### 0.3 Terminal UI Foundation
- [ ] `Terminal` container component (frame, glow, scanlines)
- [ ] `TerminalText` component with typing animation effect
- [ ] `TerminalModal` component (old-school dialog box)
- [ ] `TerminalInput` component (command-line style input)
- [ ] `TerminalHUD` frame component (border around game view)
- [ ] Terminal font loading (JetBrains Mono or similar)
- [ ] Base color theme: green phosphor, amber, white options

**Deliverable**: App shell with auth, DB, terminal-styled landing page

---

## Phase 1: Auth & Character Creation (Sprint 2)

### 1.1 Invite System
- [ ] Invite table + tRPC route to validate codes
- [ ] Registration flow: social login -> invite code prompt -> account created
- [ ] Admin: ability to generate invite codes (seed some initially)
- [ ] Redirect unauthorized users to invite wall

### 1.2 Character Management
- [ ] Character list page (show existing characters, "new" button)
- [ ] Character creation wizard:
  - Step 1: Name input (with terminal text prompt aesthetic)
  - Step 2: Class selection (Warrior/Mage/Rogue/Cleric) with stat preview
  - Step 3: Theme selection (Horror/Funny/Epic/Dark Fantasy) with flavor text
  - Step 4: Confirmation / character summary
- [ ] Character deletion with confirmation
- [ ] tRPC routes: character.list, character.create, character.delete, character.get

### 1.3 Character Data
- [ ] Class definitions with starting stats, HP formulas, abilities
- [ ] Starting inventory per class
- [ ] Starting room generation (origin 0,0)

**Deliverable**: Users can sign in, enter invite code, create/manage characters

---

## Phase 2: World & Exploration (Sprint 3)

### 2.1 Game Engine - World Generation
- [ ] `server/game/world.ts` - Room generation algorithm
  - Room type selection (weighted by depth)
  - Exit generation (1-4 exits, always connects back)
  - Room name/description generation (word banks + AI fallback)
  - Encounter chance calculation
  - Loot placement
- [ ] `server/game/dice.ts` - Dice rolling utilities
- [ ] `server/game/map.ts` - Map viewport calculation
  - Viewport sizing (15x11 default)
  - Sliding viewport algorithm (dead zone + edge detection)
  - Fog of war computation

### 2.2 Movement System
- [ ] `game.move` tRPC route
  - Validate direction against current room exits
  - Check if target room exists, generate if not
  - Update player position
  - Check for encounters
  - Return: new room data, updated player, encounter (if any)
- [ ] `game.getMap` tRPC route
  - Compute viewport based on player position + explored rooms
  - Return grid of cells with room data / fog / corridors
- [ ] `game.searchRoom` tRPC route
  - INT/WIS check for hidden items
  - Room features interaction

### 2.3 Game UI - Main View
- [ ] Main game layout: Map panel (left) + Text panel (right) + Status bar (top) + Action bar (bottom)
- [ ] `Map` component
  - ASCII grid rendering
  - Room symbols (@, fog, corridors, special markers)
  - Smooth viewport transitions
- [ ] `TextPanel` component
  - Room name and description with typing effect
  - Exits display
  - Interaction prompts
  - Action results log
- [ ] `StatusBar` component
  - Character name, level, class
  - HP/MP bars
  - Gold, XP progress
  - Position coordinates
- [ ] Action bar: movement keys, search, inventory, help
- [ ] Keyboard handler: arrow keys / WASD / NESW for movement

### 2.4 Zustand Game Store
- [ ] Game state store: current room, player data, map data, UI state
- [ ] Hydration from tRPC responses
- [ ] Action dispatchers that call tRPC mutations

**Deliverable**: Players can explore an infinite dungeon with fog of war, map viewport, room descriptions

---

## Phase 3: Combat System (Sprint 4)

### 3.1 Game Engine - Combat
- [ ] `server/game/combat.ts`
  - Initiative calculation (d20 + DEX mod)
  - Turn order management
  - Attack resolution (d20 + modifier vs AC)
  - Damage calculation (weapon die + modifier, crits)
  - Defense action (+2 AC)
  - Spell casting (MP cost, spell effects)
  - Flee check (DEX check DC 12)
  - Item use in combat
  - Monster AI (weighted: 60% attack, 20% special, 10% defend, 10% flee)
- [ ] `server/game/loot.ts`
  - Loot table rolls by monster level
  - Rarity distribution
  - Item generation from templates + random modifiers
- [ ] Monster generation from gamedata tables
- [ ] XP rewards calculation
- [ ] Death handling: respawn at last safe room, gold penalty

### 3.2 Combat UI
- [ ] `CombatPanel` component
  - Monster display (ASCII art? name, HP bar, status)
  - Turn order indicator
  - Action menu: Attack, Defend, Cast, Flee, Use Item
  - Attack sub-menu: list weapons/spells/skills from character sheet
  - Combat log with hit/miss/damage/effect messages
  - Typing effect on combat narration
  - Victory/defeat screens
- [ ] Combat entry animation (screen transition)
- [ ] Combat exit (loot summary, XP gained, level up notification)

### 3.3 Leveling
- [ ] `server/game/player.ts` - Level-up logic
  - XP threshold check
  - Stat increase (+1 primary)
  - HP roll (class die + CON mod)
  - Ability unlock at levels 3/5/7
  - Level-up notification data
- [ ] Level-up UI modal with stat changes displayed

**Deliverable**: Full combat loop - encounter, fight, loot, level up, death/respawn

---

## Phase 4: Stores, NPCs & Inventory (Sprint 5)

### 4.1 Store System
- [ ] `server/game/store.ts`
  - Store generation (inventory based on room depth + player level)
  - Pricing (base price * rarity multiplier)
  - Buy/sell with gold validation
  - Marketplace shared items
  - CHA discount calculation
- [ ] Store tRPC routes: store.getInventory, store.buy, store.sell
- [ ] `StorePanel` component
  - Item list with rarity color coding
  - Buy/sell tabs
  - Gold display, item comparison
  - Terminal-styled item cards

### 4.2 NPC System
- [ ] `server/game/npc.ts`
  - NPC generation (name, description, personality)
  - Dialogue tree generation (AI + fallback templates)
  - Dialogue state tracking
- [ ] NPC tRPC routes: npc.talk, npc.getQuests
- [ ] `NPCDialog` component
  - NPC description/portrait (ASCII?)
  - Dialogue text with typing effect
  - Numbered choice options
  - Conversation history scroll

### 4.3 Inventory Management
- [ ] `InventoryPanel` component
  - Grid-based inventory slots
  - Item details on hover/select
  - Equip/unequip actions
  - Use consumables
  - Drop items
- [ ] `CharacterSheet` component
  - Full stat display
  - Equipment slots visual
  - Abilities list
  - Level/XP progress
- [ ] Inventory slot limit enforcement
- [ ] Equipment stat bonuses applied to character

### 4.4 Player Base
- [ ] Base room (special room at fixed coordinates, always accessible)
- [ ] Fast travel to base (game.fastTravelBase)
- [ ] Base storage (extra inventory slots)
- [ ] Base store unlock at configurable level

**Deliverable**: Full economy loop - find loot, sell at store, buy gear, talk to NPCs

---

## Phase 5: Polish & Launch Prep (Sprint 6)

### 5.1 UI Polish
- [ ] Smooth map viewport transitions (CSS transitions on grid)
- [ ] Combat animations (flash, shake, etc. via CSS)
- [ ] Sound effects (optional, toggle-able) - web audio API
- [ ] Loading states with terminal-style spinners
- [ ] Error handling with themed error messages
- [ ] Responsive layout (works at different browser sizes)
- [ ] Terminal color theme selector (green/amber/white)

### 5.2 Game Balance
- [ ] Playtest combat balance across levels 1-8
- [ ] Tune encounter rates by depth
- [ ] Balance store prices and loot drops
- [ ] Verify XP curve feels good
- [ ] Ensure map generation produces interesting layouts (no infinite straight lines)

### 5.3 Infrastructure
- [ ] DigitalOcean App Platform setup
- [ ] PostgreSQL managed database provisioning
- [ ] Environment variable configuration
- [ ] Domain setup + SSL
- [ ] GitHub Actions CI: lint, type-check, test
- [ ] Auto-deploy on main push
- [ ] Basic monitoring / error tracking (Sentry free tier)

### 5.4 Admin Tools
- [ ] Simple admin page (check if user is admin)
- [ ] Generate invite codes
- [ ] View registered users
- [ ] Basic game stats (characters created, rooms explored)

### 5.5 Content Safety
- [ ] AI content filtering layer
- [ ] Character name validation (no slurs/inappropriate content)
- [ ] Room annotation content filtering (P1)

**Deliverable**: Production-ready MVP deployed and accessible to invited users

---

## Phase 6: Post-MVP Features (P1)

### 6.1 Quest System
- [ ] Quest generation engine (AI-powered)
- [ ] Story quests: multi-step narrative chains
- [ ] Daily quests: procedural objective generation
- [ ] Quest acceptance triggers world content generation
- [ ] Quest journal UI
- [ ] Quest completion + rewards

### 6.2 Fast Travel Stones
- [ ] Stone item type + drop mechanics
- [ ] Stone placement on rooms
- [ ] Fast travel UI (map with stone markers)
- [ ] Return mechanic (teleport back to origin)
- [ ] Stone limit calculation (ratio to explored map size)

### 6.3 Room Annotations
- [ ] Annotation CRUD
- [ ] Personal map overlay UI
- [ ] Logical room ID system
- [ ] Note display on map hover

### 6.4 Rare Random Events
- [ ] Event table with probabilities
- [ ] Event triggers during exploration
- [ ] Unique encounters, lore discoveries, special loot

---

## Sprint Timeline Estimate

| Sprint | Phase | Focus |
|--------|-------|-------|
| 1 | Phase 0 | Scaffold, DB, terminal UI foundation |
| 2 | Phase 1 | Auth, invites, character creation |
| 3 | Phase 2 | World gen, movement, map, exploration UI |
| 4 | Phase 3 | Combat system, leveling, loot |
| 5 | Phase 4 | Stores, NPCs, inventory, player base |
| 6 | Phase 5 | Polish, deploy, launch prep |
| 7+ | Phase 6 | Quests, fast travel, annotations, events |

---

## Technical Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| AI API costs for generation | Cache aggressively, use word banks as fallback, batch generation |
| Map viewport performance with large worlds | Only query rooms in viewport range, DB index on (character_id, x, y) |
| Combat balance | Start simple, tune via config constants, playtest early |
| Terminal aesthetic limiting UX | Shadcn gives us escape hatches - modals, forms, tooltips all work within the theme |
| Infinite world memory | Lazy generation + DB storage means only explored rooms exist |
| Content safety | Filter at generation time, re-roll on flag, validate user inputs |

## Config Constants (Tunable)

```typescript
export const GAME_CONFIG = {
  MAP_VIEWPORT_WIDTH: 15,
  MAP_VIEWPORT_HEIGHT: 11,
  MAP_DEAD_ZONE: 3,              // cells from center before viewport moves
  MAX_INVENTORY_SLOTS: 20,
  BASE_UNLOCK_LEVEL: 5,
  BASE_STORE_UNLOCK_LEVEL: 8,
  DEATH_GOLD_PENALTY: 0.25,
  ENCOUNTER_BASE_CHANCE: 0.3,
  ENCOUNTER_DEPTH_MODIFIER: 0.02, // +2% per depth
  STORE_CHA_DISCOUNT_PER_MOD: 0.05,
  // P1
  STONE_BASE_DROP_RATE: 0.01,
  STONE_DROP_RATE_INCREASE: 0.001, // per room explored
  STONE_MAX_COUNT: 5,
  STONE_MAX_RATIO: 0.1,           // max stones = explored_rooms * ratio
};
```
