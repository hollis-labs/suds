import { describe, it, expect } from "vitest";
import {
  xpForLevel,
  statModifier,
  CLASS_DEFINITIONS,
  THEMES,
  ROOM_TYPES,
  XP_TABLE,
} from "@/lib/constants";

describe("xpForLevel", () => {
  it("returns 0 for level 1", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("returns correct values for levels 1-20", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(300);
    expect(xpForLevel(3)).toBe(600);
    expect(xpForLevel(5)).toBe(2400);
    expect(xpForLevel(10)).toBe(76800);
    expect(xpForLevel(15)).toBe(2457600);
    expect(xpForLevel(20)).toBe(78643200);
  });

  it("matches XP_TABLE for all levels 1-20", () => {
    for (let level = 1; level <= 20; level++) {
      expect(xpForLevel(level)).toBe(XP_TABLE[level]);
    }
  });

  it("handles levels > 20 by doubling", () => {
    const xp20 = xpForLevel(20);
    expect(xpForLevel(21)).toBe(xp20 * 2);
    expect(xpForLevel(22)).toBe(xp20 * 4);
    expect(xpForLevel(23)).toBe(xp20 * 8);
  });

  it("returns 0 for level 0", () => {
    expect(xpForLevel(0)).toBe(0);
  });

  it("returns 0 for negative levels", () => {
    expect(xpForLevel(-1)).toBe(0);
  });
});

describe("statModifier", () => {
  it("stat 10 = 0", () => {
    expect(statModifier(10)).toBe(0);
  });

  it("stat 11 = 0", () => {
    expect(statModifier(11)).toBe(0);
  });

  it("stat 8 = -1", () => {
    expect(statModifier(8)).toBe(-1);
  });

  it("stat 9 = -1", () => {
    expect(statModifier(9)).toBe(-1);
  });

  it("stat 14 = +2", () => {
    expect(statModifier(14)).toBe(2);
  });

  it("stat 20 = +5", () => {
    expect(statModifier(20)).toBe(5);
  });

  it("stat 1 = -5", () => {
    expect(statModifier(1)).toBe(-5);
  });

  it("stat 12 = +1", () => {
    expect(statModifier(12)).toBe(1);
  });

  it("stat 13 = +1", () => {
    expect(statModifier(13)).toBe(1);
  });

  it("stat 6 = -2", () => {
    expect(statModifier(6)).toBe(-2);
  });

  it("stat 7 = -2", () => {
    expect(statModifier(7)).toBe(-2);
  });
});

describe("CLASS_DEFINITIONS", () => {
  const requiredFields = [
    "name",
    "primary",
    "hpDie",
    "mpBase",
    "startingStats",
    "startingAC",
    "abilities",
    "description",
  ];

  const requiredStats = ["str", "dex", "con", "int", "wis", "cha"];

  it("has all expected classes", () => {
    expect(Object.keys(CLASS_DEFINITIONS)).toEqual(
      expect.arrayContaining([
        "fighter", "wizard", "rogue", "cleric",
        "barbarian", "bard", "druid", "monk",
        "paladin", "ranger", "sorcerer", "warlock",
      ])
    );
  });

  for (const [className, classDef] of Object.entries(CLASS_DEFINITIONS)) {
    describe(className, () => {
      for (const field of requiredFields) {
        it(`has required field: ${field}`, () => {
          expect(classDef).toHaveProperty(field);
        });
      }

      it("has all six stats in startingStats", () => {
        for (const stat of requiredStats) {
          expect(classDef.startingStats).toHaveProperty(stat);
          expect(
            typeof classDef.startingStats[stat as keyof typeof classDef.startingStats]
          ).toBe("number");
        }
      });

      it("has a string name", () => {
        expect(typeof classDef.name).toBe("string");
        expect(classDef.name.length).toBeGreaterThan(0);
      });

      it("has a string description", () => {
        expect(typeof classDef.description).toBe("string");
        expect(classDef.description.length).toBeGreaterThan(0);
      });

      it("has a valid primary stat", () => {
        expect(requiredStats).toContain(classDef.primary);
      });

      it("has numeric hpDie and mpBase", () => {
        expect(typeof classDef.hpDie).toBe("number");
        expect(classDef.hpDie).toBeGreaterThan(0);
        expect(typeof classDef.mpBase).toBe("number");
        expect(classDef.mpBase).toBeGreaterThan(0);
      });

      it("has abilities as an object", () => {
        expect(typeof classDef.abilities).toBe("object");
        expect(Object.keys(classDef.abilities).length).toBeGreaterThan(0);
      });
    });
  }
});

describe("THEMES", () => {
  const requiredFields = ["name", "description"];

  it("has at least one theme", () => {
    expect(Object.keys(THEMES).length).toBeGreaterThan(0);
  });

  for (const [themeKey, themeDef] of Object.entries(THEMES)) {
    describe(themeKey, () => {
      for (const field of requiredFields) {
        it(`has required field: ${field}`, () => {
          expect(themeDef).toHaveProperty(field);
        });
      }

      it("name is a non-empty string", () => {
        expect(typeof themeDef.name).toBe("string");
        expect(themeDef.name.length).toBeGreaterThan(0);
      });

      it("description is a non-empty string", () => {
        expect(typeof themeDef.description).toBe("string");
        expect(themeDef.description.length).toBeGreaterThan(0);
      });
    });
  }
});

describe("ROOM_TYPES", () => {
  const requiredFields = ["name", "shallowWeight", "deepWeight"];

  it("has at least one room type", () => {
    expect(Object.keys(ROOM_TYPES).length).toBeGreaterThan(0);
  });

  for (const [roomKey, roomDef] of Object.entries(ROOM_TYPES)) {
    describe(roomKey, () => {
      for (const field of requiredFields) {
        it(`has required field: ${field}`, () => {
          expect(roomDef).toHaveProperty(field);
        });
      }

      it("name is a non-empty string", () => {
        expect(typeof roomDef.name).toBe("string");
        expect(roomDef.name.length).toBeGreaterThan(0);
      });

      it("shallowWeight is a non-negative number", () => {
        expect(typeof roomDef.shallowWeight).toBe("number");
        expect(roomDef.shallowWeight).toBeGreaterThanOrEqual(0);
      });

      it("deepWeight is a non-negative number", () => {
        expect(typeof roomDef.deepWeight).toBe("number");
        expect(roomDef.deepWeight).toBeGreaterThanOrEqual(0);
      });
    });
  }
});
