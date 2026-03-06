import { describe, it, expect } from "vitest";
import {
  generateStore,
  getMarketplaceItems,
  calculateBuyPrice,
  calculateSellPrice,
} from "@/server/game/store";
import type { GameItem } from "@/lib/types";

describe("generateStore", () => {
  it("produces a valid store with name and items", () => {
    const store = generateStore(5, 3, "epic");
    expect(store.name).toBeTruthy();
    expect(typeof store.name).toBe("string");
    expect(Array.isArray(store.localInventory)).toBe(true);
  });

  it("has 8-12 local items", () => {
    for (let i = 0; i < 20; i++) {
      const store = generateStore(5, 3, "horror");
      expect(store.localInventory.length).toBeGreaterThanOrEqual(8);
      expect(store.localInventory.length).toBeLessThanOrEqual(12);
    }
  });

  it("items have valid prices > 0", () => {
    const store = generateStore(10, 5, "funny");
    for (const si of store.localInventory) {
      expect(si.price).toBeGreaterThan(0);
    }
  });

  it("items have valid stock > 0", () => {
    const store = generateStore(10, 5, "dark_fantasy");
    for (const si of store.localInventory) {
      expect(si.stock).toBeGreaterThan(0);
    }
  });

  it("items have valid GameItem properties", () => {
    const store = generateStore(5, 3, "epic");
    for (const si of store.localInventory) {
      expect(si.item.id).toBeTruthy();
      expect(si.item.itemId).toBeTruthy();
      expect(si.item.name).toBeTruthy();
      expect(typeof si.item.type).toBe("string");
      expect(typeof si.item.rarity).toBe("string");
    }
  });

  it("depth increases item prices", () => {
    // Generate many stores at depth 0 and depth 10, compare average prices
    let depth0Total = 0;
    let depth10Total = 0;
    const iterations = 20;

    for (let i = 0; i < iterations; i++) {
      const store0 = generateStore(5, 0, "epic");
      const store10 = generateStore(5, 10, "epic");
      depth0Total += store0.localInventory.reduce((sum, si) => sum + si.price, 0);
      depth10Total += store10.localInventory.reduce((sum, si) => sum + si.price, 0);
    }

    expect(depth10Total / iterations).toBeGreaterThan(depth0Total / iterations);
  });
});

describe("calculateBuyPrice", () => {
  const testItem: GameItem = {
    id: "test-1",
    itemId: "iron_sword",
    name: "Iron Sword",
    type: "weapon",
    rarity: "common",
    stats: { damage: 6 },
    quantity: 1,
    slot: null,
    isEquipped: false,
  };

  it("gives discount for high CHA", () => {
    const normalPrice = calculateBuyPrice(testItem, 10); // CHA 10 = +0 mod
    const highChaPrice = calculateBuyPrice(testItem, 18); // CHA 18 = +4 mod = 20% discount

    expect(highChaPrice).toBeLessThan(normalPrice);
  });

  it("does not discount below 50% of base", () => {
    const minPrice = calculateBuyPrice(testItem, 30); // Very high CHA
    const normalPrice = calculateBuyPrice(testItem, 10);

    expect(minPrice).toBeGreaterThanOrEqual(Math.round(normalPrice * 0.5));
  });

  it("returns a positive price", () => {
    const price = calculateBuyPrice(testItem, 10);
    expect(price).toBeGreaterThan(0);
  });
});

describe("calculateSellPrice", () => {
  const testItem: GameItem = {
    id: "test-1",
    itemId: "iron_sword",
    name: "Iron Sword",
    type: "weapon",
    rarity: "common",
    stats: { damage: 6 },
    quantity: 1,
    slot: null,
    isEquipped: false,
  };

  it("is approximately 40% of buy price", () => {
    const buyPrice = calculateBuyPrice(testItem, 10); // CHA 10 = no discount
    const sellPrice = calculateSellPrice(testItem);

    // Sell should be 40% of the full price (same as buy at CHA 10)
    expect(sellPrice).toBe(Math.round(buyPrice * 0.4));
  });

  it("returns a positive price", () => {
    const price = calculateSellPrice(testItem);
    expect(price).toBeGreaterThan(0);
  });
});

describe("getMarketplaceItems", () => {
  it("returns standard items", () => {
    const items = getMarketplaceItems(1);
    expect(items.length).toBeGreaterThan(0);
  });

  it("includes health and mana potions", () => {
    const items = getMarketplaceItems(1);
    const names = items.map((si) => si.item.name);
    expect(names).toContain("Health Potion");
    expect(names).toContain("Mana Potion");
  });

  it("all items have valid prices and stock", () => {
    const items = getMarketplaceItems(5);
    for (const si of items) {
      expect(si.price).toBeGreaterThan(0);
      expect(si.stock).toBeGreaterThan(0);
    }
  });

  it("includes basic weapons and armor", () => {
    const items = getMarketplaceItems(1);
    const types = items.map((si) => si.item.type);
    expect(types).toContain("weapon");
    expect(types).toContain("armor");
  });
});
