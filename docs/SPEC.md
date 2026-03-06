# SUDS v2 - Technical Specification

## Architecture Overview

```
Browser (React SPA)
    |
    | HTTPS / WebSocket
    |
Next.js App (Vercel-style, hosted on DO)
    |
    |-- API Routes (tRPC or REST)
    |-- Server Actions
    |-- Auth (NextAuth.js)
    |
PostgreSQL (DO Managed Database)
    |
    |-- Users, sessions, invites
    |-- Game state (JSONB columns for flexible game data)
    |-- World data (rooms, NPCs, stores, quests)
```

## Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 15 (App Router) | Fullstack React, SSR, API routes, great DX |
| **UI** | React 19 + Shadcn/ui + Tailwind CSS 4 | Component library with full control, terminal theming |
| **State** | Zustand (client) | Lightweight, no boilerplate, props-down pattern friendly |
| **API** | tRPC | End-to-end type safety, great with Next.js |
| **Auth** | NextAuth.js v5 (Auth.js) | Social login (Google, GitHub, Discord), session management |
| **Database** | PostgreSQL 16 | JSONB for game state, relational for users/auth, robust |
| **ORM** | Drizzle ORM | Lightweight, type-safe, SQL-first |
| **AI** | Anthropic Claude API | Quest generation, NPC dialogue, lore, room descriptions |
| **Hosting** | DigitalOcean App Platform | Simple deployment, managed DB, affordable |
| **Realtime** | Server-Sent Events (SSE) | For typing effects, combat animations, event streaming |
| **Testing** | Vitest + Playwright | Unit + E2E testing |
| **Monorepo** | Turborepo (optional, start flat) | If we need to split packages later |

## Project Structure

```
suds-v2/
  src/
    app/                    # Next.js App Router pages
      (auth)/               # Auth pages (login, invite)
      (game)/               # Game pages (behind auth)
        play/               # Main game view
        characters/         # Character list/create
      api/                  # API routes
        trpc/[trpc]/        # tRPC handler
      layout.tsx
      page.tsx              # Landing/login
    components/
      ui/                   # Shadcn components (button, dialog, etc.)
      terminal/             # Terminal-themed components
        Terminal.tsx         # Main terminal container
        TerminalText.tsx     # Typing effect text renderer
        TerminalHUD.tsx      # HUD overlay frame
        TerminalModal.tsx    # Old-school modal/dialog
        TerminalInput.tsx    # Command input
      game/                 # Game-specific components
        Map.tsx             # ASCII map viewport
        MapCell.tsx         # Individual map cell
        CombatPanel.tsx     # Combat UI
        InventoryPanel.tsx  # Inventory display
        StorePanel.tsx      # Store buy/sell UI
        NPCDialog.tsx       # NPC conversation
        StatusBar.tsx       # Player stats HUD
        TextPanel.tsx       # Room description / narrative
        CharacterSheet.tsx  # Full character view
    server/
      db/
        schema.ts           # Drizzle schema definitions
        index.ts            # DB connection
        migrations/         # SQL migrations
      trpc/
        router.ts           # Root tRPC router
        context.ts          # tRPC context (auth, db)
        routers/
          auth.ts           # Auth procedures
          character.ts      # Character CRUD
          game.ts           # Core game actions (move, interact)
          combat.ts         # Combat procedures
          store.ts          # Store procedures
          quest.ts          # Quest procedures
      game/                 # Game engine (ALL game logic here)
        engine.ts           # Core game loop / action dispatcher
        world.ts            # World generation, room creation
        combat.ts           # Combat resolution, damage calc
        loot.ts             # Loot tables, drop generation
        store.ts            # Store inventory, pricing
        npc.ts              # NPC generation, dialogue
        quest.ts            # Quest generation, tracking
        player.ts           # Player state, leveling, stats
        dice.ts             # Dice rolling utilities
        map.ts              # Map viewport calculation, fog of war
        ai.ts               # AI integration for content generation
      gamedata/             # Static game data tables
        monsters.json
        items.json
        rooms.json
        names.json
        themes.json
    lib/
      utils.ts              # General utilities
      constants.ts          # Game constants, config
    hooks/
      useGame.ts            # Game state hook
      useTerminal.ts        # Terminal effects hook
      useMap.ts             # Map viewport hook
      useKeyboard.ts        # Keyboard shortcut handler
    stores/
      gameStore.ts          # Zustand game state
  public/
    fonts/                  # Monospace/terminal fonts
  drizzle.config.ts
  next.config.ts
  tailwind.config.ts
  package.json
  tsconfig.json
```

## Database Schema

### Users & Auth

```sql
-- Managed by NextAuth
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  email         TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  image         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts (
  -- NextAuth managed: provider, providerAccountId, etc.
);

CREATE TABLE sessions (
  -- NextAuth managed: sessionToken, userId, expires
);
```

### Invite System

```sql
CREATE TABLE invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  created_by  UUID REFERENCES users(id),
  used_by     UUID REFERENCES users(id),
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Game State

```sql
CREATE TABLE characters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) NOT NULL,
  name        TEXT NOT NULL,
  class       TEXT NOT NULL,  -- warrior, mage, rogue, cleric
  theme       TEXT NOT NULL,  -- horror, funny, epic, dark_fantasy
  level       INT DEFAULT 1,
  xp          INT DEFAULT 0,
  xp_next     INT DEFAULT 300,
  hp          INT NOT NULL,
  hp_max      INT NOT NULL,
  mp          INT NOT NULL,
  mp_max      INT NOT NULL,
  gold        INT DEFAULT 50,
  stats       JSONB NOT NULL,  -- {str, dex, con, int, wis, cha}
  ac          INT NOT NULL,
  position    JSONB NOT NULL DEFAULT '{"x":0,"y":0}',
  equipment   JSONB NOT NULL DEFAULT '{}',
  abilities   TEXT[] DEFAULT '{}',
  last_safe   JSONB DEFAULT '{"x":0,"y":0}',
  base_level  INT DEFAULT 0,  -- upgrades to base
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  item_id       TEXT NOT NULL,         -- references gamedata item template
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,         -- weapon, armor, potion, scroll, accessory
  rarity        TEXT NOT NULL,         -- common, uncommon, rare, epic, legendary
  stats         JSONB DEFAULT '{}',
  quantity      INT DEFAULT 1,
  slot          INT,                   -- inventory slot position
  is_equipped   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  x             INT NOT NULL,
  y             INT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  description   TEXT NOT NULL,
  exits         TEXT[] NOT NULL,       -- ['north','south','east']
  depth         INT NOT NULL,
  has_encounter BOOLEAN DEFAULT FALSE,
  encounter_data JSONB,
  has_loot      BOOLEAN DEFAULT FALSE,
  loot_data     JSONB,
  visited       BOOLEAN DEFAULT FALSE,
  room_features JSONB DEFAULT '{}',   -- searchable objects, hidden items, etc.
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, x, y)
);

CREATE TABLE stores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  room_x        INT NOT NULL,
  room_y        INT NOT NULL,
  name          TEXT NOT NULL,
  inventory     JSONB NOT NULL,        -- local store items
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, room_x, room_y)
);

-- Shared marketplace items available at all stores
CREATE TABLE marketplace_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_data   JSONB NOT NULL,
  min_level   INT DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE npcs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  room_x        INT NOT NULL,
  room_y        INT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  dialogue      JSONB NOT NULL,        -- dialogue tree
  quest_id      UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, room_x, room_y, name)
);

CREATE TABLE combat_state (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
  monsters      JSONB NOT NULL,
  turn_order    JSONB NOT NULL,
  current_turn  INT DEFAULT 0,
  round         INT DEFAULT 1,
  log           JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- P1: Quests
CREATE TABLE quests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,         -- story, daily
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  objectives    JSONB NOT NULL,
  rewards       JSONB NOT NULL,
  status        TEXT DEFAULT 'available', -- available, active, complete, failed
  given_by      UUID REFERENCES npcs(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- P1: Fast travel stones
CREATE TABLE travel_stones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  room_x        INT NOT NULL,
  room_y        INT NOT NULL,
  placed_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, room_x, room_y)
);

-- P1: Room annotations
CREATE TABLE room_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id  UUID REFERENCES characters(id) ON DELETE CASCADE,
  room_x        INT NOT NULL,
  room_y        INT NOT NULL,
  note          TEXT,
  marker        TEXT,                  -- custom marker symbol
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, room_x, room_y)
);
```

## Key Design Decisions

### 1. Game Logic is Server-Side Only

All game logic (combat resolution, loot drops, room generation, stat calculations) runs on the server in `src/server/game/`. The client is purely presentational. This:
- Prevents cheating
- Keeps game state authoritative
- Mirrors v1's philosophy (TUI = pure UI)

### 2. Per-Character World State

Each character has their own world instance. Rooms, stores, NPCs are scoped to a character. This simplifies MVP and matches the "Single User Dungeon" concept. MUD mode (P2) would add shared world tables.

### 3. JSONB for Flexible Game Data

PostgreSQL JSONB columns for stats, equipment, loot, dialogue trees, etc. This avoids excessive normalization for game data that varies by type while keeping relational structure for core entities.

### 4. AI Content Generation

Claude API generates:
- Room descriptions (themed to session flavor)
- NPC dialogue trees
- Quest narratives and objectives
- Lore fragments
- Item flavor text

Fallback: static word bank tables (from v1 gamedata) when AI is unavailable or for non-critical content. AI generation happens server-side, results are cached in DB.

### 5. Terminal Web Aesthetic

The entire UI is wrapped in a terminal-style container:
- Monospace font (e.g., JetBrains Mono, Fira Code)
- Dark background with phosphor-green/amber text options
- Scanline overlay effect (subtle CSS)
- Text typing animations for narrative content
- Modal dialogs styled as terminal windows
- ASCII box-drawing characters for borders and UI chrome
- Custom Shadcn theme that matches terminal aesthetic

### 6. Map Viewport Algorithm

The map viewport is a fixed-size grid (e.g., 15x11 cells). The viewport position follows these rules:
- Player position is always visible
- Viewport slides smoothly rather than snapping to center
- When player is near an explored edge, viewport shifts to show more explored territory
- Dead zone in center (player can move within it without viewport moving)
- When player exits dead zone, viewport slides one cell in that direction
- Edge case: if explored area is smaller than viewport, center on explored area

### 7. Props Down, Events Up

React component architecture follows strict unidirectional data flow:
- Game state flows down through props from page-level components
- User actions emit events/callbacks upward
- Zustand store holds client-side game state, hydrated from server responses
- No global state access from deep components - pass what's needed via props
- tRPC mutations for all game actions, responses update the store

## API Design (tRPC Routers)

### `auth`
- `auth.getSession` - Current session
- `auth.validateInvite` - Check invite code validity

### `character`
- `character.list` - List user's characters
- `character.create` - Create new character (name, class, theme)
- `character.delete` - Delete character and all associated data
- `character.get` - Get full character state

### `game`
- `game.move` - Move in direction, returns new room + player state
- `game.searchRoom` - Search current room for hidden content
- `game.interact` - Interact with room feature (chest, lever, etc.)
- `game.getMap` - Get map viewport data for rendering
- `game.rest` - Rest at safe room (full heal)
- `game.fastTravelBase` - Travel to player base

### `combat`
- `combat.getState` - Current combat state
- `combat.action` - Take combat action (attack, defend, cast, flee, useItem)
- `combat.resolve` - Check if combat is over, distribute rewards

### `store`
- `store.getInventory` - Get store + marketplace items
- `store.buy` - Purchase item
- `store.sell` - Sell item

### `npc`
- `npc.talk` - Start/continue NPC dialogue
- `npc.getQuests` - Get available quests from NPC

### `quest` (P1)
- `quest.list` - List active/available quests
- `quest.accept` - Accept a quest
- `quest.checkProgress` - Check quest objectives

## Security

- All game state mutations server-side only
- Auth required for all game API routes
- Invite code validated during registration
- Rate limiting on API routes (prevent automation/botting)
- Content safety filtering on AI-generated content
- Input sanitization on all user inputs (character name, room notes)
- CSRF protection via NextAuth

## Deployment (DigitalOcean)

```
DO App Platform
  |-- Web Service: Next.js app (Node.js buildpack)
  |-- Managed PostgreSQL database
  |-- Environment variables: AUTH secrets, AI API keys, DB URL
```

- Auto-deploy from GitHub main branch
- Preview deployments for PRs
- Managed SSL certificates
- Horizontal scaling if needed (stateless server)

## Performance Considerations

- Room generation is async but fast (AI calls cached)
- Map viewport calculation is O(rooms in viewport) - fast
- Combat resolution is single DB transaction
- JSONB indexes on frequently queried paths (position, character_id)
- Connection pooling via Drizzle/pg
- Static game data loaded once at server startup
