import type { GameItem, StoreItem } from "@/lib/types";
import type { Rarity, Theme } from "@/lib/constants";
import { RARITY, GAME_CONFIG, statModifier } from "@/lib/constants";
import { roll } from "@/server/game/dice";
import { nanoid } from "nanoid";
import itemsData from "@/server/gamedata/items.json";
import namesData from "@/server/gamedata/names.json";

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

// ---------------------------------------------------------------------------
// Store generation
// ---------------------------------------------------------------------------

/**
 * Generate a store with a name and local inventory.
 *
 * @param playerLevel - The player's current level
 * @param depth - Distance from origin (Manhattan distance)
 * @param theme - Current dungeon theme (reserved for future use)
 * @returns Store name and local inventory items
 */
export function generateStore(
  playerLevel: number,
  depth: number,
  _theme: Theme,
): { name: string; localInventory: StoreItem[] } {
  // Pick a random store name
  const storeNames = namesData.storeNames;
  const name = storeNames[Math.floor(Math.random() * storeNames.length)]!;

  // Generate 8-12 local items
  const itemCount = 8 + roll(5) - 1; // 8 to 12
  const localInventory: StoreItem[] = [];

  // Filter items by appropriate level range: allow items up to playerLevel + 2 tiers of rarity
  // Common/uncommon always available; rare at level 3+; epic at level 5+; legendary at level 8+
  const rarityLevelGate: Record<Rarity, number> = {
    common: 1,
    uncommon: 1,
    rare: 3,
    epic: 5,
    legendary: 8,
  };

  const availableItems = ITEMS.filter(
    (item) => playerLevel >= rarityLevelGate[item.rarity],
  );

  // Fallback to all items if filtering is too restrictive
  const pool = availableItems.length > 0 ? availableItems : ITEMS;

  // Pick random items (allow duplicates across different picks, but try to vary)
  const pickedIds = new Set<string>();
  let attempts = 0;

  while (localInventory.length < itemCount && attempts < itemCount * 3) {
    attempts++;
    const template = pool[Math.floor(Math.random() * pool.length)]!;

    // Avoid duplicates in the store
    if (pickedIds.has(template.id)) continue;
    pickedIds.add(template.id);

    const rarityConfig = RARITY[template.rarity];
    const price = Math.round(
      template.basePrice * rarityConfig.priceMultiplier * (1 + depth * 0.1),
    );

    // Stock: rarer items get lower stock
    let stock: number;
    if (
      template.rarity === "epic" ||
      template.rarity === "legendary"
    ) {
      stock = 1;
    } else if (
      template.rarity === "rare" ||
      template.rarity === "uncommon"
    ) {
      stock = roll(3); // 1-3
    } else {
      stock = 3 + roll(8) - 1; // 3-10
    }

    const item: GameItem = {
      id: nanoid(),
      itemId: template.id,
      name: template.name,
      type: template.type,
      rarity: template.rarity,
      stats: { ...template.stats },
      quantity: 1,
      slot: null,
      isEquipped: false,
      description: template.description,
    };

    localInventory.push({ item, price, stock });
  }

  return { name, localInventory };
}

// ---------------------------------------------------------------------------
// Marketplace (standard items always available)
// ---------------------------------------------------------------------------

/** Standard marketplace items available to all players. Fixed prices, unlimited stock. */
export function getMarketplaceItems(_playerLevel: number): StoreItem[] {
  const marketplaceTemplateIds = [
    "health_potion",
    "mana_potion",
    "healing_salve",
    "rusty_sword",
    "iron_sword",
    "hand_axe",
    "leather_armor",
    "wooden_shield",
    "iron_helm",
    "scroll_shield",
    "scroll_heal",
  ];

  const result: StoreItem[] = [];

  for (const templateId of marketplaceTemplateIds) {
    const template = ITEMS.find((i) => i.id === templateId);
    if (!template) continue;

    const item: GameItem = {
      id: nanoid(),
      itemId: template.id,
      name: template.name,
      type: template.type,
      rarity: template.rarity,
      stats: { ...template.stats },
      quantity: 1,
      slot: null,
      isEquipped: false,
      description: template.description,
    };

    result.push({
      item,
      price: template.basePrice,
      stock: 99, // unlimited
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Price calculations
// ---------------------------------------------------------------------------

/**
 * Calculate buy price adjusted by CHA modifier.
 * Each +1 CHA mod = -5% price, min 50% of base.
 */
export function calculateBuyPrice(item: GameItem, playerCha: number): number {
  const template = ITEMS.find((t) => t.id === item.itemId);
  const basePrice = template?.basePrice ?? 10;
  const rarityConfig = RARITY[item.rarity];
  const fullPrice = basePrice * rarityConfig.priceMultiplier;

  const chaMod = statModifier(playerCha);
  const discount = chaMod * GAME_CONFIG.STORE_CHA_DISCOUNT_PER_MOD;
  const multiplier = Math.max(0.5, 1 - discount);

  return Math.round(fullPrice * multiplier);
}

/**
 * Calculate sell price: 40% of base price.
 */
export function calculateSellPrice(item: GameItem): number {
  const template = ITEMS.find((t) => t.id === item.itemId);
  const basePrice = template?.basePrice ?? 10;
  const rarityConfig = RARITY[item.rarity];
  const fullPrice = basePrice * rarityConfig.priceMultiplier;

  return Math.round(fullPrice * 0.4);
}
