// Position
export interface Position {
  x: number;
  y: number;
}

// Stats
export interface Stats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

// Item
export interface GameItem {
  id: string;
  itemId: string;
  name: string;
  type: "weapon" | "armor" | "potion" | "scroll" | "accessory";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  stats: Record<string, number>;
  quantity: number;
  slot: number | null;
  isEquipped: boolean;
  description?: string;
}

// Equipment slots
export interface Equipment {
  weapon?: GameItem;
  armor?: GameItem;
  accessory?: GameItem; // legacy catch-all
  ring?: GameItem;
  amulet?: GameItem;
  boots?: GameItem;
}

// Active buffs (shield, blessing, etc.)
export interface PlayerBuff {
  type: "shield" | "blessing";
  /** For shield: remaining absorb points. For blessing: bonus value. */
  value: number;
  /** For blessing: "attack" or "ac" */
  stat?: "attack" | "ac";
  /** For blessing: combats remaining before expiry */
  combatsRemaining?: number;
}

// Shrine data stored in roomFeatures
export interface ShrineData {
  shrineType: "healing" | "shield" | "blessing";
  usesRemaining: number;
  maxUses: number;
}

// Player
export interface Player {
  id: string;
  name: string;
  class: string;
  theme: string;
  level: number;
  xp: number;
  xpNext: number;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  gold: number;
  stats: Stats;
  ac: number;
  position: Position;
  equipment: Equipment;
  abilities: string[];
  lastSafe: Position;
  baseLevel: number;
  companion?: Companion | null;
  buffs?: PlayerBuff[];
  worldId?: string | null;
  currentRegionId?: string | null;
  currentAreaId?: string | null;
  currentBuildingId?: string | null;
}

// Room
export interface Room {
  id: string;
  x: number;
  y: number;
  name: string;
  type: string;
  description: string;
  exits: string[];
  depth: number;
  hasEncounter: boolean;
  encounterData: MonsterEncounter | null;
  hasLoot: boolean;
  lootData: GameItem[] | null;
  visited: boolean;
  roomFeatures: Record<string, unknown>;
  buildingId?: string;
}

// Companion (NPC adventurer ally)
export interface Companion {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: number;
  hpMax: number;
  ac: number;
  attack: number;
  damage: string; // dice notation
  abilities: string[];
  personality: string;
}

// Monster
export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  hpMax: number;
  ac: number;
  attack: number;
  damage: string; // dice notation e.g. "1d6+2"
  xp: number;
  abilities: string[];
  description: string;
}

// Combat
export interface MonsterEncounter {
  monsters: Monster[];
}

export interface CombatState {
  id: string;
  monsters: Monster[];
  companion?: Companion | null;
  turnOrder: { type: "player" | "monster" | "companion"; index?: number }[];
  currentTurn: number;
  round: number;
  log: CombatLogEntry[];
}

export interface CombatLogEntry {
  round: number;
  actor: string;
  action: string;
  target?: string;
  result: string;
  damage?: number;
}

export type CombatAction = "attack" | "defend" | "cast" | "flee" | "use_item";

// Store
export interface StoreItem {
  item: GameItem;
  price: number;
  stock: number;
}

export interface Store {
  id: string;
  name: string;
  localInventory: StoreItem[];
  marketplaceInventory: StoreItem[];
}

// NPC
export interface DialogueNode {
  id: string;
  text: string;
  choices: { text: string; nextId: string | null; action?: string }[];
}

export interface NPC {
  id: string;
  name: string;
  description: string;
  dialogue: Record<string, DialogueNode>;
  currentNode: string;
}

// Map
export interface MapCell {
  x: number;
  y: number;
  room: Room | null;
  isVisible: boolean;
  isCurrent: boolean;
  hasPlayer: boolean;
  connections: {
    north: boolean;
    south: boolean;
    east: boolean;
    west: boolean;
  };
}

export interface MapViewport {
  cells: MapCell[][];
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

// Hierarchical position for new world system
export interface HierarchicalPosition {
  worldId: string;
  regionId: string;
  areaId: string;
  buildingId?: string;
  floor?: number;
  x: number;
  y: number;
}

/** Type guard: returns true if position is legacy flat {x, y} */
export function isLegacyPosition(pos: Position | HierarchicalPosition): pos is Position {
  return !("worldId" in pos);
}

/** Extract {x, y} from either position format */
export function getXY(pos: Position | HierarchicalPosition): Position {
  return { x: pos.x, y: pos.y };
}

// Direction
export type Direction = "north" | "south" | "east" | "west";

// Navigation layer in the world hierarchy
export type NavigationLayer = "world" | "region" | "area" | "building";

// Game state for client store
export interface GameState {
  player: Player | null;
  currentRoom: Room | null;
  mapViewport: MapViewport | null;
  combatState: CombatState | null;
  activeStore: Store | null;
  activeNPC: NPC | null;
  gameLog: string[];
  isLoading: boolean;
  screen:
    | "exploring"
    | "combat"
    | "store"
    | "npc"
    | "inventory"
    | "character"
    | "death"
    | "level_up"
    | "lore"
    | "party"
    | "news"
    | "about"
    | "world_map"
    | "region_map";
}
