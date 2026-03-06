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
  accessory?: GameItem;
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
  turnOrder: { type: "player" | "monster"; index?: number }[];
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

// Direction
export type Direction = "north" | "south" | "east" | "west";

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
    | "level_up";
}
