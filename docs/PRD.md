# SUDS v2 - Product Requirements Document

## Vision

SUDS (Single User Dungeons) is a web-based dungeon crawler with a retro terminal aesthetic. Players explore a procedurally generated, infinite dungeon world through a browser interface that looks and feels like a classic text terminal but leverages modern web UI capabilities (modals, animations, forms, HUD overlays). The game combines MUD-style exploration with D&D-lite mechanics, AI-generated quests/lore, and persistent world state.

## Target Audience

- Casual gamers who enjoy roguelikes, MUDs, or D&D
- Retro/terminal aesthetic enthusiasts
- Players looking for a pick-up-and-play browser game with depth

## Business Model

- Free to play, no monetization planned
- Invite-only at launch
- Open source

## Core Product Requirements

### P0 - MVP

#### Authentication & Access
- Social login (Google, GitHub, Discord) - no password management
- Invite-only gating: new users must have a valid invite code
- Each user gets their own game instance (single-player)
- Users can create multiple characters/sessions

#### Character Creation
- Choose character name
- Choose class (Warrior, Mage, Rogue, Cleric)
- Choose world theme/flavor (Horror, Funny, Epic, Dark Fantasy)
- D&D 5e-lite stat system with class-based starting stats

#### World & Exploration
- Infinite procedurally generated dungeon map
- Rooms generated just-in-time as the player explores
- Once generated, rooms are permanent and persistent
- Room types: Corridor, Chamber, Shrine, Trap Room, Store, NPC Room, Boss Room, Safe Room
- Fog of war - only explored rooms visible on map
- Dead ends exist but the map never terminates entirely
- Map grows organically in all directions

#### Map Display
- Fixed viewport showing a portion of the total map
- Map auto-scrolls to keep relevant area in view
- Map does NOT center on player - it slides smoothly
- Player can be near edge, center, side - map adjusts viewport intelligently
- ASCII/ANSI-style room and corridor rendering

#### Movement & Interaction
- Cardinal direction movement (N/S/E/W)
- Search room, investigate objects, interact with environment
- Talk to NPCs with dialogue trees
- Discover lore through exploration
- Open chests, find hidden items

#### Combat System
- Turn-based D&D-lite combat
- Actions: Attack (choose weapon/spell/skill from character sheet), Defend, Cast, Flee, Use Item
- D20 attack rolls, damage calculation, critical hits
- Monster AI with weighted action selection
- XP rewards, leveling system
- Death: respawn at last safe room, lose 25% gold

#### Inventory & Equipment
- Inventory slots (configurable max)
- Equipment slots: weapon, armor, accessory
- Item rarities: Common, Uncommon, Rare, Epic, Legendary
- Item categories: Weapons, Armor, Potions, Scrolls, Accessories

#### Stores & Economy
- Stores at fixed room locations (randomly placed, permanent once set)
- Buy and sell items
- Common marketplace shared across all stores
- Each store also has unique local inventory
- Store unlocks at player base at certain level

#### NPCs & Dialogue
- Procedurally generated NPCs with dialogue trees
- NPCs can give quests, share lore, sell items
- NPC interactions influenced by CHA stat

#### Player Base
- Fast travel to personal base from anywhere
- Base has extra inventory storage
- Base gets a store at certain player level

#### UI/UX - Terminal Web Aesthetic
- Web app styled as a retro terminal
- ASCII/ANSI-style graphics in browser
- Terminal-style HUD surrounding main game view
- Text typing effects for room descriptions and dialogue
- Old-school hypertext-style modals for menus
- Forms for character creation and input
- Simple animations (combat effects, transitions)
- Keyboard navigation support

### P1 - Post-MVP

#### Quests
- AI-generated quest lines
- Story quests: multi-step, cinematic, lore-heavy narrative chains
- Daily/repeatable quests: "Go kill X vampires in area Y"
- Quest acceptance triggers content generation (enemies, items placed in world)
- Quest tracking in player journal

#### Fast Travel Stones
- Rare magic items (stones/pebbles) that bind to rooms
- Players place stones to mark rooms for fast travel
- Stone drop rate increases slowly over time
- Configurable MAX stones a player can have active
- Fast travel: teleport to marked room, can return to origin
- Leaving the marked room resets the return point
- Stone limit scales as ratio to total map size explored

#### Player Map Annotations
- Personal inventory map (smaller overlay)
- Mark rooms with custom notes
- Logical room ID system players can reference
- Route planning capability

#### Rare Random Events
- Low-probability unique encounters while exploring
- Special loot, NPCs, story moments
- Keeps exploration fresh and surprising

#### Configurable Encounter Tuning
- System-level config to adjust encounter rates, difficulty curves
- Per-session difficulty preferences

#### Advanced Combat
- Keyboard hotkeys for spells/attacks (WoW-style)
- Spell/ability assignment to keybinds
- More complex monster AI

### P2 - Future

#### Multiplayer / MUD Mode
- Shared world instances
- See other players in rooms
- Trading between players
- Party system for co-op dungeon runs

#### More Classes & Abilities
- Ranger, Paladin, Bard, etc.
- Deeper ability trees

#### Crafting System
- Combine items to create gear
- Crafting stations in world

#### Boss Mechanics
- Multi-phase fights
- Unique boss abilities and patterns

#### Mobile Support
- Responsive design for tablets
- Touch-friendly controls
- Eventually native mobile apps

## Success Metrics (MVP)

- Users can create account, create character, and start playing within 2 minutes
- Game runs smoothly in modern browsers (Chrome, Firefox, Safari, Edge)
- World generates seamlessly with no noticeable loading during exploration
- Average session length > 15 minutes (engagement)
- Zero game-breaking bugs in core loop (move, fight, loot, level)

## Constraints

- All open source / free tooling
- Self-contained application (no external game engine dependency)
- Must run on Windows, Mac, Linux browsers
- Content safety: no sexual content, abuse, graphic real-world violence, slurs
- Invite-only access control at launch
