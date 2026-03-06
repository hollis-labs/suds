import { describe, it, expect } from "vitest";
import {
  createNewCharacter,
  calculateLevelUp,
  getStatModifier,
  getPlayerAC,
} from "@/server/game/player";
import {
  CLASS_DEFINITIONS,
  GAME_CONFIG,
  xpForLevel,
  statModifier,
  type CharacterClass,
} from "@/lib/constants";
import type { Stats, Equipment, GameItem } from "@/lib/types";

const CLASSES: CharacterClass[] = ["warrior", "mage", "rogue", "cleric"];

describe("createNewCharacter", () => {
  it.each(CLASSES)("returns valid data for %s class", (cls) => {
    const { character, inventoryItems } = createNewCharacter(
      "TestHero",
      cls,
      "epic"
    );

    expect(character.name).toBe("TestHero");
    expect(character.class).toBe(cls);
    expect(character.theme).toBe("epic");
    expect(character.level).toBe(1);
    expect(character.xp).toBe(0);
    expect(character.position).toEqual({ x: 0, y: 0 });
    expect(character.lastSafe).toEqual({ x: 0, y: 0 });
    expect(character.baseLevel).toBe(0);
    expect(character.abilities.length).toBeGreaterThan(0);
    expect(inventoryItems.length).toBeGreaterThan(0);
  });

  it.each(CLASSES)(
    "calculates starting HP correctly for %s (hpDie max + CON mod)",
    (cls) => {
      const classDef = CLASS_DEFINITIONS[cls];
      const conMod = statModifier(classDef.startingStats.con);
      const expectedHp = classDef.hpDie + conMod;

      const { character } = createNewCharacter("TestHero", cls, "epic");

      expect(character.hp).toBe(expectedHp);
      expect(character.hpMax).toBe(expectedHp);
    }
  );

  it.each(CLASSES)("MP matches class mpBase for %s", (cls) => {
    const classDef = CLASS_DEFINITIONS[cls];
    const { character } = createNewCharacter("TestHero", cls, "epic");

    expect(character.mp).toBe(classDef.mpBase);
    expect(character.mpMax).toBe(classDef.mpBase);
  });

  it.each(CLASSES)("starting stats match class definitions for %s", (cls) => {
    const classDef = CLASS_DEFINITIONS[cls];
    const { character } = createNewCharacter("TestHero", cls, "epic");

    expect(character.stats).toEqual(classDef.startingStats);
  });

  it.each(CLASSES)("starting abilities are correct for %s", (cls) => {
    const classDef = CLASS_DEFINITIONS[cls];
    const { character } = createNewCharacter("TestHero", cls, "epic");

    expect(character.abilities).toEqual([...(classDef.abilities[1] ?? [])]);
  });

  it("starting gold matches GAME_CONFIG.STARTING_GOLD", () => {
    const { character } = createNewCharacter("TestHero", "warrior", "epic");
    expect(character.gold).toBe(GAME_CONFIG.STARTING_GOLD);
  });

  it("xpNext is set to level 2 threshold", () => {
    const { character } = createNewCharacter("TestHero", "warrior", "epic");
    expect(character.xpNext).toBe(xpForLevel(2));
  });

  it("warrior gets rusty_sword and leather_armor", () => {
    const { inventoryItems } = createNewCharacter("TestHero", "warrior", "epic");
    const weapon = inventoryItems.find((i) => i.type === "weapon");
    const armor = inventoryItems.find((i) => i.type === "armor");

    expect(weapon).toBeDefined();
    expect(weapon!.itemId).toBe("rusty_sword");
    expect(armor).toBeDefined();
    expect(armor!.itemId).toBe("leather_armor");
  });

  it("mage gets wooden_staff and no armor", () => {
    const { inventoryItems } = createNewCharacter("TestHero", "mage", "epic");
    const weapon = inventoryItems.find((i) => i.type === "weapon");
    const armor = inventoryItems.find((i) => i.type === "armor");

    expect(weapon).toBeDefined();
    expect(weapon!.itemId).toBe("wooden_staff");
    expect(armor).toBeUndefined();
  });

  it("rogue gets rusty_dagger and leather_armor", () => {
    const { inventoryItems } = createNewCharacter("TestHero", "rogue", "epic");
    const weapon = inventoryItems.find((i) => i.type === "weapon");
    const armor = inventoryItems.find((i) => i.type === "armor");

    expect(weapon).toBeDefined();
    expect(weapon!.itemId).toBe("rusty_dagger");
    expect(armor).toBeDefined();
    expect(armor!.itemId).toBe("leather_armor");
  });

  it("cleric gets wooden_mace and chain_mail", () => {
    const { inventoryItems } = createNewCharacter("TestHero", "cleric", "epic");
    const weapon = inventoryItems.find((i) => i.type === "weapon");
    const armor = inventoryItems.find((i) => i.type === "armor");

    expect(weapon).toBeDefined();
    expect(weapon!.itemId).toBe("wooden_mace");
    expect(armor).toBeDefined();
    expect(armor!.itemId).toBe("chain_mail");
  });

  it("AC matches class startingAC", () => {
    for (const cls of CLASSES) {
      const classDef = CLASS_DEFINITIONS[cls];
      const { character } = createNewCharacter("TestHero", cls, "epic");
      expect(character.ac).toBe(classDef.startingAC);
    }
  });
});

describe("calculateLevelUp", () => {
  it("returns correct new level", () => {
    const stats: Stats = { ...CLASS_DEFINITIONS.warrior.startingStats };
    const result = calculateLevelUp(1, stats, "warrior");
    expect(result.newLevel).toBe(2);
  });

  it("HP gained is at least 1", () => {
    // Use a class with low HP die and low CON to stress min-1 rule
    const stats: Stats = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    for (let i = 0; i < 50; i++) {
      const result = calculateLevelUp(1, stats, "mage");
      expect(result.hpGained).toBeGreaterThanOrEqual(1);
    }
  });

  it("increases the correct primary stat", () => {
    for (const cls of CLASSES) {
      const classDef = CLASS_DEFINITIONS[cls];
      const stats: Stats = { ...classDef.startingStats };
      const result = calculateLevelUp(1, stats, cls);
      expect(result.statIncreased).toBe(classDef.primary);
    }
  });

  it("gives abilities at correct levels", () => {
    const stats: Stats = { ...CLASS_DEFINITIONS.warrior.startingStats };

    // Level 2 -> no new abilities for warrior
    const level2 = calculateLevelUp(1, stats, "warrior");
    expect(level2.newAbilities).toEqual([]);

    // Level 3 -> shield_block
    const level3 = calculateLevelUp(2, stats, "warrior");
    expect(level3.newAbilities).toEqual(["shield_block"]);

    // Level 5 -> cleave
    const level5 = calculateLevelUp(4, stats, "warrior");
    expect(level5.newAbilities).toEqual(["cleave"]);

    // Level 7 -> battle_cry
    const level7 = calculateLevelUp(6, stats, "warrior");
    expect(level7.newAbilities).toEqual(["battle_cry"]);
  });

  it("sets correct xpNext threshold", () => {
    const stats: Stats = { ...CLASS_DEFINITIONS.warrior.startingStats };
    const result = calculateLevelUp(1, stats, "warrior");
    // New level is 2, so xpNext should be xpForLevel(3)
    expect(result.xpNext).toBe(xpForLevel(3));
  });

  it("HP gained is bounded by hpDie + CON mod range", () => {
    const stats: Stats = { ...CLASS_DEFINITIONS.warrior.startingStats };
    const conMod = statModifier(stats.con);
    const classDef = CLASS_DEFINITIONS.warrior;

    for (let i = 0; i < 100; i++) {
      const result = calculateLevelUp(1, stats, "warrior");
      expect(result.hpGained).toBeGreaterThanOrEqual(
        Math.max(1, 1 + conMod)
      );
      expect(result.hpGained).toBeLessThanOrEqual(classDef.hpDie + conMod);
    }
  });
});

describe("getStatModifier", () => {
  it("matches D&D rules", () => {
    // Standard D&D stat modifier table
    expect(getStatModifier(1)).toBe(-5);
    expect(getStatModifier(2)).toBe(-4);
    expect(getStatModifier(3)).toBe(-4);
    expect(getStatModifier(8)).toBe(-1);
    expect(getStatModifier(9)).toBe(-1);
    expect(getStatModifier(10)).toBe(0);
    expect(getStatModifier(11)).toBe(0);
    expect(getStatModifier(12)).toBe(1);
    expect(getStatModifier(13)).toBe(1);
    expect(getStatModifier(14)).toBe(2);
    expect(getStatModifier(15)).toBe(2);
    expect(getStatModifier(16)).toBe(3);
    expect(getStatModifier(17)).toBe(3);
    expect(getStatModifier(18)).toBe(4);
    expect(getStatModifier(19)).toBe(4);
    expect(getStatModifier(20)).toBe(5);
  });
});

describe("getPlayerAC", () => {
  it("calculates AC from base 10 + DEX mod when no armor", () => {
    const stats: Stats = { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 };
    const equipment: Equipment = {};
    // DEX 14 -> mod +2, so AC = 10 + 2 = 12
    expect(getPlayerAC(stats, equipment)).toBe(12);
  });

  it("adds armor defense bonus", () => {
    const stats: Stats = { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 };
    const armor: GameItem = {
      id: "1",
      itemId: "plate",
      name: "Plate",
      type: "armor",
      rarity: "common",
      stats: { defense: 5 },
      quantity: 1,
      slot: null,
      isEquipped: true,
    };
    const equipment: Equipment = { armor };
    // 10 + 2 (DEX) + 5 (armor) = 17
    expect(getPlayerAC(stats, equipment)).toBe(17);
  });

  it("handles negative DEX modifier", () => {
    const stats: Stats = { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 };
    const equipment: Equipment = {};
    // DEX 8 -> mod -1, so AC = 10 + (-1) = 9
    expect(getPlayerAC(stats, equipment)).toBe(9);
  });
});
