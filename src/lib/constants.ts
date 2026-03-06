export const GAME_CONFIG = {
  MAP_VIEWPORT_WIDTH: 15,
  MAP_VIEWPORT_HEIGHT: 11,
  MAP_DEAD_ZONE: 3,
  MAX_INVENTORY_SLOTS: 20,
  BASE_UNLOCK_LEVEL: 5,
  BASE_STORE_UNLOCK_LEVEL: 8,
  DEATH_GOLD_PENALTY: 0.25,
  ENCOUNTER_BASE_CHANCE: 0.3,
  ENCOUNTER_DEPTH_MODIFIER: 0.02,
  STORE_CHA_DISCOUNT_PER_MOD: 0.05,
  STONE_BASE_DROP_RATE: 0.01,
  STONE_DROP_RATE_INCREASE: 0.001,
  STONE_MAX_COUNT: 5,
  STONE_MAX_RATIO: 0.1,
  MAX_LEVEL: 20,
  STARTING_GOLD: 50,
} as const;

export const CLASS_DEFINITIONS = {
  warrior: {
    name: "Warrior",
    primary: "str" as const,
    hpDie: 10,
    mpBase: 10,
    startingStats: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
    startingAC: 16,
    abilities: {
      1: ["power_attack"],
      3: ["shield_block"],
      5: ["cleave"],
      7: ["battle_cry"],
    },
    description: "A mighty fighter skilled in melee combat and heavy armor.",
  },
  mage: {
    name: "Mage",
    primary: "int" as const,
    hpDie: 6,
    mpBase: 30,
    startingStats: { str: 8, dex: 12, con: 12, int: 16, wis: 14, cha: 10 },
    startingAC: 11,
    abilities: {
      1: ["arcane_missile"],
      3: ["fireball"],
      5: ["ice_shield"],
      7: ["chain_lightning"],
    },
    description: "A scholarly spellcaster wielding arcane forces.",
  },
  rogue: {
    name: "Rogue",
    primary: "dex" as const,
    hpDie: 8,
    mpBase: 15,
    startingStats: { str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 12 },
    startingAC: 14,
    abilities: {
      1: ["sneak_attack"],
      3: ["pick_lock"],
      5: ["dodge"],
      7: ["assassinate"],
    },
    description: "A cunning adventurer specializing in stealth and precision.",
  },
  cleric: {
    name: "Cleric",
    primary: "wis" as const,
    hpDie: 8,
    mpBase: 25,
    startingStats: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    startingAC: 15,
    abilities: {
      1: ["heal"],
      3: ["smite"],
      5: ["bless"],
      7: ["divine_shield"],
    },
    description: "A holy warrior who channels divine power to heal and smite.",
  },
} as const;

export type CharacterClass = keyof typeof CLASS_DEFINITIONS;
export type StatName = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const THEMES = {
  horror: {
    name: "Horror",
    description: "Dark, dread, decay. Undead horrors lurk in every shadow.",
  },
  funny: {
    name: "Funny",
    description: "Absurd, pun-filled chaos. Nothing is too ridiculous.",
  },
  epic: {
    name: "Epic",
    description: "Grand, ancient, mythic. Heroes of legend walk these halls.",
  },
  dark_fantasy: {
    name: "Dark Fantasy",
    description: "Grim, forsaken, eerie. A world corrupted and tragic.",
  },
} as const;

export type Theme = keyof typeof THEMES;

export const RARITY = {
  common: {
    name: "Common",
    color: "text-terminal-white",
    dropRate: 0.5,
    priceMultiplier: 1,
  },
  uncommon: {
    name: "Uncommon",
    color: "text-green-400",
    dropRate: 0.25,
    priceMultiplier: 3,
  },
  rare: {
    name: "Rare",
    color: "text-terminal-blue",
    dropRate: 0.15,
    priceMultiplier: 8,
  },
  epic: {
    name: "Epic",
    color: "text-terminal-purple",
    dropRate: 0.08,
    priceMultiplier: 20,
  },
  legendary: {
    name: "Legendary",
    color: "text-terminal-gold",
    dropRate: 0.02,
    priceMultiplier: 50,
  },
} as const;

export type Rarity = keyof typeof RARITY;

export const ROOM_TYPES = {
  corridor: { name: "Corridor", shallowWeight: 30, deepWeight: 20 },
  chamber: { name: "Chamber", shallowWeight: 25, deepWeight: 20 },
  shrine: { name: "Shrine", shallowWeight: 10, deepWeight: 10 },
  trap_room: { name: "Trap Room", shallowWeight: 5, deepWeight: 15 },
  store: { name: "Store", shallowWeight: 10, deepWeight: 5 },
  npc_room: { name: "NPC Room", shallowWeight: 10, deepWeight: 5 },
  boss_room: { name: "Boss Room", shallowWeight: 0, deepWeight: 15 },
  safe_room: { name: "Safe Room", shallowWeight: 10, deepWeight: 10 },
} as const;

export type RoomType = keyof typeof ROOM_TYPES;

export const XP_TABLE: Record<number, number> = {
  1: 0,
  2: 300,
  3: 600,
  4: 1200,
  5: 2400,
  6: 4800,
  7: 9600,
  8: 19200,
  9: 38400,
  10: 76800,
  11: 153600,
  12: 307200,
  13: 614400,
  14: 1228800,
  15: 2457600,
  16: 4915200,
  17: 9830400,
  18: 19660800,
  19: 39321600,
  20: 78643200,
};

/** XP required to reach a given level */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 20) return XP_TABLE[level] ?? 0;
  return XP_TABLE[20]! * Math.pow(2, level - 20);
}

/** D&D-style stat modifier: (stat - 10) / 2, rounded down */
export function statModifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}
