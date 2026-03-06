import {
  CLASS_DEFINITIONS,
  GAME_CONFIG,
  xpForLevel,
  statModifier,
  type CharacterClass,
  type Theme,
} from "@/lib/constants";
import type { Stats, Equipment } from "@/lib/types";
import { roll } from "@/server/game/dice";

// Starting equipment per class
const STARTING_EQUIPMENT: Record<
  CharacterClass,
  { weapon: { itemId: string; name: string } | null; armor: { itemId: string; name: string } | null }
> = {
  warrior: {
    weapon: { itemId: "rusty_sword", name: "Rusty Sword" },
    armor: { itemId: "leather_armor", name: "Leather Armor" },
  },
  mage: {
    weapon: { itemId: "wooden_staff", name: "Wooden Staff" },
    armor: null,
  },
  rogue: {
    weapon: { itemId: "rusty_dagger", name: "Rusty Dagger" },
    armor: { itemId: "leather_armor", name: "Leather Armor" },
  },
  cleric: {
    weapon: { itemId: "wooden_mace", name: "Wooden Mace" },
    armor: { itemId: "chain_mail", name: "Chain Mail" },
  },
};

export interface CharacterData {
  name: string;
  class: CharacterClass;
  theme: Theme;
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
  position: { x: number; y: number };
  equipment: Equipment;
  abilities: string[];
  lastSafe: { x: number; y: number };
  baseLevel: number;
}

export interface StartingInventoryItem {
  itemId: string;
  name: string;
  type: "weapon" | "armor";
  rarity: "common";
  stats: Record<string, number>;
  quantity: number;
  isEquipped: boolean;
}

export interface LevelUpData {
  newLevel: number;
  hpGained: number;
  statIncreased: string;
  newAbilities: string[];
  xpNext: number;
}

/**
 * Create a new character with full starting data.
 */
export function createNewCharacter(
  name: string,
  characterClass: CharacterClass,
  theme: Theme
): { character: CharacterData; inventoryItems: StartingInventoryItem[] } {
  const classDef = CLASS_DEFINITIONS[characterClass];
  const stats: Stats = { ...classDef.startingStats };
  const conMod = statModifier(stats.con);

  // Starting HP: hpDie max + CON modifier (generous start)
  const hpMax = classDef.hpDie + conMod;
  const mpMax = classDef.mpBase;

  // Starting abilities from level 1
  const abilities = [...(classDef.abilities[1] ?? [])];

  // Build equipment object from starting items
  const startingEquip = STARTING_EQUIPMENT[characterClass];
  const equipment: Equipment = {};
  const inventoryItems: StartingInventoryItem[] = [];

  if (startingEquip.weapon) {
    const weaponItem: StartingInventoryItem = {
      itemId: startingEquip.weapon.itemId,
      name: startingEquip.weapon.name,
      type: "weapon",
      rarity: "common",
      stats: { attack: 2 },
      quantity: 1,
      isEquipped: true,
    };
    inventoryItems.push(weaponItem);
  }

  if (startingEquip.armor) {
    const armorItem: StartingInventoryItem = {
      itemId: startingEquip.armor.itemId,
      name: startingEquip.armor.name,
      type: "armor",
      rarity: "common",
      stats: { defense: 2 },
      quantity: 1,
      isEquipped: true,
    };
    inventoryItems.push(armorItem);
  }

  const character: CharacterData = {
    name,
    class: characterClass,
    theme,
    level: 1,
    xp: 0,
    xpNext: xpForLevel(2),
    hp: hpMax,
    hpMax,
    mp: mpMax,
    mpMax,
    gold: GAME_CONFIG.STARTING_GOLD,
    stats,
    ac: classDef.startingAC,
    position: { x: 0, y: 0 },
    equipment,
    abilities,
    lastSafe: { x: 0, y: 0 },
    baseLevel: 0,
  };

  return { character, inventoryItems };
}

/**
 * Calculate level-up results for a character.
 */
export function calculateLevelUp(
  currentLevel: number,
  currentStats: Stats,
  characterClass: CharacterClass
): LevelUpData {
  const classDef = CLASS_DEFINITIONS[characterClass];
  const newLevel = currentLevel + 1;

  // HP gained: roll hpDie + CON mod (min 1)
  const conMod = statModifier(currentStats.con);
  const hpRoll = roll(classDef.hpDie);
  const hpGained = Math.max(1, hpRoll + conMod);

  // +1 to primary stat
  const statIncreased = classDef.primary;

  // New abilities at this level
  const newAbilities =
    (classDef.abilities as Record<number, readonly string[]>)[newLevel] ?? [];

  // New XP threshold
  const xpNext = xpForLevel(newLevel + 1);

  return {
    newLevel,
    hpGained,
    statIncreased,
    newAbilities: [...newAbilities],
    xpNext,
  };
}

/**
 * Get D&D-style stat modifier: (stat - 10) / 2, rounded down.
 */
export function getStatModifier(stat: number): number {
  return statModifier(stat);
}

/**
 * Calculate AC from base + DEX mod + armor bonus.
 */
export function getPlayerAC(
  stats: Stats,
  equipment: Equipment
): number {
  const dexMod = statModifier(stats.dex);
  const armorBonus = equipment.armor?.stats?.defense ?? 0;
  return 10 + dexMod + armorBonus;
}
