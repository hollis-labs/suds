/**
 * Equipment slot helpers.
 *
 * Accessories are sub-typed into ring, amulet, and boots based on itemId.
 * Items that don't match a sub-type go into the generic "accessory" slot.
 */

export type EquipSlot = "weapon" | "armor" | "accessory" | "ring" | "amulet" | "boots";

/**
 * Determine the equipment slot for an item based on its type and itemId.
 * Weapons → weapon, Armor → armor, Accessories → ring/amulet/boots/accessory.
 */
export function getEquipSlot(type: string, itemId: string): EquipSlot {
  if (type === "weapon") return "weapon";
  if (type === "armor") return "armor";
  if (type !== "accessory") return "accessory";

  // Sub-type accessories by itemId pattern
  const id = itemId.toLowerCase();
  if (id.includes("ring")) return "ring";
  if (id.includes("amulet")) return "amulet";
  if (id.includes("boots")) return "boots";
  // Crown, cloak, etc. → generic accessory
  return "accessory";
}

/**
 * Build the equipment object from a list of inventory items.
 * Each slot gets at most one equipped item.
 */
export function buildEquipmentSlots<T extends { type: string; itemId: string; isEquipped: boolean }>(
  items: T[]
): { weapon?: T; armor?: T; accessory?: T; ring?: T; amulet?: T; boots?: T } {
  const result: Record<string, T | undefined> = {};

  for (const item of items) {
    if (!item.isEquipped) continue;
    const slot = getEquipSlot(item.type, item.itemId);
    // First equipped item for this slot wins
    if (!result[slot]) {
      result[slot] = item;
    }
  }

  return result as { weapon?: T; armor?: T; accessory?: T; ring?: T; amulet?: T; boots?: T };
}
