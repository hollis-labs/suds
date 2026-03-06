import type { GameItem } from "@/lib/types";
import type { Rarity, Theme } from "@/lib/constants";
import { RARITY } from "@/lib/constants";
import { roll } from "@/server/game/dice";
import { nanoid } from "nanoid";
import itemsData from "@/server/gamedata/items.json";

interface ItemTemplate {
  id: string;
  name: string;
  type: "weapon" | "armor" | "potion" | "scroll" | "accessory";
  rarity: Rarity;
  stats: Record<string, number>;
  basePrice: number;
  description: string;
}

const ITEMS: ItemTemplate[] = itemsData as unknown as ItemTemplate[];

// Ordered from most common to rarest
const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

// ---------------------------------------------------------------------------
// Rarity rolling
// ---------------------------------------------------------------------------

/**
 * Roll a rarity value, with depth bonus shifting probabilities toward better tiers.
 * depthBonus shifts the roll upward, making rarer items more likely at deeper levels.
 */
export function rollRarity(depthBonus: number): Rarity {
  // Base cumulative thresholds from RARITY drop rates:
  // common: 0.50, uncommon: 0.25, rare: 0.15, epic: 0.08, legendary: 0.02
  // cumulative: common < 0.50, uncommon < 0.75, rare < 0.90, epic < 0.98, legendary < 1.00

  // Build cumulative thresholds from the end (legendary first) so we can check
  // from rarest to most common. depthBonus lowers each threshold, making rarer
  // results easier to land.
  //
  // Reverse cumulative: legendary threshold = 1 - 0.02 = 0.98
  //                     epic threshold     = 0.98 - 0.08 = 0.90
  //                     rare threshold     = 0.90 - 0.15 = 0.75
  //                     uncommon threshold = 0.75 - 0.25 = 0.50
  //                     everything else    = common
  //
  // The depthBonus shifts each threshold down by (depthBonus * 0.015) making it
  // easier to exceed the threshold and land a rarer item.
  const rawRoll = Math.random();
  const shift = depthBonus * 0.015;

  const reversed = [...RARITY_ORDER].reverse(); // legendary, epic, rare, uncommon, common
  let cumulativeFromTop = 0;
  for (const rarity of reversed) {
    cumulativeFromTop += RARITY[rarity].dropRate;
    const threshold = Math.max(0, 1 - cumulativeFromTop - shift);
    if (rawRoll >= threshold && rarity !== "common") {
      return rarity;
    }
  }

  return "common";
}

// ---------------------------------------------------------------------------
// Loot generation
// ---------------------------------------------------------------------------

/**
 * Generate loot items for the player.
 *
 * @param playerLevel - The player's current level
 * @param depth - Distance from origin (Manhattan distance)
 * @param theme - Current dungeon theme (unused for now, reserved for future filtering)
 * @param count - Number of items to generate (default: random 1-3)
 * @returns Array of GameItem instances with unique IDs
 */
export function generateLoot(
  playerLevel: number,
  depth: number,
  theme: Theme,
  count?: number
): GameItem[] {
  const itemCount = count ?? roll(3); // 1-3 items
  const result: GameItem[] = [];

  for (let i = 0; i < itemCount; i++) {
    const rarity = rollRarity(depth);

    // Filter items by rarity
    const pool = ITEMS.filter((item) => item.rarity === rarity);

    // Fallback: if no items for this rarity, pick from all items
    const finalPool = pool.length > 0 ? pool : ITEMS;

    // Pick random template
    const template = finalPool[Math.floor(Math.random() * finalPool.length)]!;

    // Scale stats based on depth: +1 per 3 depth levels
    const depthScaling = Math.floor(depth / 3);
    const scaledStats: Record<string, number> = {};
    for (const [key, value] of Object.entries(template.stats)) {
      scaledStats[key] = value + depthScaling;
    }

    const item: GameItem = {
      id: nanoid(),
      itemId: template.id,
      name: template.name,
      type: template.type,
      rarity: template.rarity,
      stats: scaledStats,
      quantity: 1,
      slot: null,
      isEquipped: false,
      description: template.description,
    };

    result.push(item);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Gold generation
// ---------------------------------------------------------------------------

/**
 * Generate a gold drop amount.
 *
 * Base gold: 5 * playerLevel
 * Modified by depth: +10% per depth level
 * Random variance: +/- 30%
 */
export function generateGoldDrop(playerLevel: number, depth: number): number {
  const base = 5 * playerLevel;
  const depthMultiplier = 1 + depth * 0.1;
  const variance = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
  const gold = Math.round(base * depthMultiplier * variance);
  return Math.max(1, gold);
}
