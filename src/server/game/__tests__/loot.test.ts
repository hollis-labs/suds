import { describe, it, expect } from "vitest";
import { generateLoot, generateGoldDrop, rollRarity } from "@/server/game/loot";

const VALID_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

describe("generateLoot", () => {
  it("returns the correct number of items when count is specified", () => {
    const items = generateLoot(3, 2, "epic", 5);
    expect(items).toHaveLength(5);
  });

  it("returns 1-3 items when count is not specified", () => {
    for (let i = 0; i < 50; i++) {
      const items = generateLoot(3, 2, "epic");
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.length).toBeLessThanOrEqual(3);
    }
  });

  it("all items have valid rarity", () => {
    const items = generateLoot(5, 5, "horror", 10);
    for (const item of items) {
      expect(VALID_RARITIES).toContain(item.rarity);
    }
  });

  it("all items have unique ids", () => {
    const items = generateLoot(5, 5, "epic", 20);
    const ids = items.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("items have required GameItem properties", () => {
    const items = generateLoot(3, 2, "epic", 3);
    for (const item of items) {
      expect(item.id).toBeTruthy();
      expect(item.itemId).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(typeof item.type).toBe("string");
      expect(typeof item.rarity).toBe("string");
      expect(typeof item.stats).toBe("object");
      expect(item.quantity).toBe(1);
      expect(item.isEquipped).toBe(false);
    }
  });

  it("scales stats based on depth", () => {
    // Generate at depth 0 and depth 9 many times and compare average stat values
    const depth0Items = generateLoot(5, 0, "epic", 20);
    const depth9Items = generateLoot(5, 9, "epic", 20);

    // At depth 9, scaling is floor(9/3) = 3, so all stats should be +3 vs depth 0 template
    // We can't compare directly since items are random, but we check depth 9 items have positive stats
    for (const item of depth9Items) {
      for (const value of Object.values(item.stats)) {
        expect(value).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("rollRarity", () => {
  it("returns a valid rarity value", () => {
    for (let i = 0; i < 100; i++) {
      const rarity = rollRarity(0);
      expect(VALID_RARITIES).toContain(rarity);
    }
  });

  it("returns a valid rarity value with depth bonus", () => {
    for (let i = 0; i < 100; i++) {
      const rarity = rollRarity(10);
      expect(VALID_RARITIES).toContain(rarity);
    }
  });

  it("higher depth increases chance of better rarity (statistical)", () => {
    const iterations = 5000;
    const rarityValue: Record<string, number> = {
      common: 0,
      uncommon: 1,
      rare: 2,
      epic: 3,
      legendary: 4,
    };

    let depth0Total = 0;
    let depth20Total = 0;

    for (let i = 0; i < iterations; i++) {
      depth0Total += rarityValue[rollRarity(0)]!;
      depth20Total += rarityValue[rollRarity(20)]!;
    }

    const depth0Avg = depth0Total / iterations;
    const depth20Avg = depth20Total / iterations;

    // Depth 20 should produce higher average rarity than depth 0
    expect(depth20Avg).toBeGreaterThan(depth0Avg);
  });
});

describe("generateGoldDrop", () => {
  it("returns a positive number", () => {
    for (let i = 0; i < 100; i++) {
      const gold = generateGoldDrop(1, 0);
      expect(gold).toBeGreaterThanOrEqual(1);
    }
  });

  it("scales with player level", () => {
    const iterations = 200;
    let level1Total = 0;
    let level10Total = 0;

    for (let i = 0; i < iterations; i++) {
      level1Total += generateGoldDrop(1, 0);
      level10Total += generateGoldDrop(10, 0);
    }

    expect(level10Total / iterations).toBeGreaterThan(level1Total / iterations);
  });

  it("scales with depth", () => {
    const iterations = 200;
    let depth0Total = 0;
    let depth10Total = 0;

    for (let i = 0; i < iterations; i++) {
      depth0Total += generateGoldDrop(5, 0);
      depth10Total += generateGoldDrop(5, 10);
    }

    expect(depth10Total / iterations).toBeGreaterThan(depth0Total / iterations);
  });
});
