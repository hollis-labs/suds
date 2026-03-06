import { describe, it, expect } from "vitest";
import {
  roll,
  rollMultiple,
  rollDice,
  rollD20,
  rollInitiative,
  rollCheck,
} from "@/server/game/dice";

const ITERATIONS = 100;

describe("roll", () => {
  it("returns a value between 1 and sides", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = roll(6);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it("returns a value between 1 and sides for d20", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = roll(20);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });

  it("returns 1 for a 1-sided die", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      expect(roll(1)).toBe(1);
    }
  });
});

describe("rollMultiple", () => {
  it("returns the correct number of dice", () => {
    const results = rollMultiple(5, 6);
    expect(results).toHaveLength(5);
  });

  it("returns an empty array for 0 dice", () => {
    const results = rollMultiple(0, 6);
    expect(results).toHaveLength(0);
  });

  it("each die result is within range", () => {
    const results = rollMultiple(10, 8);
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(8);
    }
  });
});

describe("rollDice", () => {
  it("parses 2d6+3 notation correctly", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollDice("2d6+3");
      expect(result).toBeGreaterThanOrEqual(2 + 3); // min: 2*1 + 3 = 5
      expect(result).toBeLessThanOrEqual(12 + 3); // max: 2*6 + 3 = 15
    }
  });

  it("1d20 returns 1-20", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollDice("1d20");
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });

  it("3d8 returns 3-24", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollDice("3d8");
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThanOrEqual(24);
    }
  });

  it("1d6+5 returns 6-11", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollDice("1d6+5");
      expect(result).toBeGreaterThanOrEqual(6);
      expect(result).toBeLessThanOrEqual(11);
    }
  });

  it("1d1 always returns 1", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      expect(rollDice("1d1")).toBe(1);
    }
  });

  it("0d6 returns 0 (zero dice)", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      expect(rollDice("0d6")).toBe(0);
    }
  });

  it("handles negative modifiers", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollDice("1d20-5");
      expect(result).toBeGreaterThanOrEqual(1 - 5); // -4
      expect(result).toBeLessThanOrEqual(20 - 5); // 15
    }
  });

  it("throws on invalid notation", () => {
    expect(() => rollDice("abc")).toThrow("Invalid dice notation");
    expect(() => rollDice("d20")).toThrow("Invalid dice notation");
    expect(() => rollDice("")).toThrow("Invalid dice notation");
  });
});

describe("rollD20", () => {
  it("returns 1-20", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollD20();
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });
});

describe("rollInitiative", () => {
  it("returns roll + dexMod", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollInitiative(3);
      expect(result).toBeGreaterThanOrEqual(1 + 3); // min d20 + mod
      expect(result).toBeLessThanOrEqual(20 + 3); // max d20 + mod
    }
  });

  it("handles negative dex modifier", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollInitiative(-2);
      expect(result).toBeGreaterThanOrEqual(1 - 2);
      expect(result).toBeLessThanOrEqual(20 - 2);
    }
  });

  it("handles zero dex modifier", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollInitiative(0);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(20);
    }
  });
});

describe("rollCheck", () => {
  it("returns correct shape", () => {
    const result = rollCheck(5, 15);
    expect(result).toHaveProperty("roll");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("critical");
    expect(result).toHaveProperty("fumble");
  });

  it("total equals roll + modifier", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollCheck(3, 10);
      expect(result.total).toBe(result.roll + 3);
    }
  });

  it("roll is between 1 and 20", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollCheck(0, 10);
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(20);
    }
  });

  it("success when total >= dc", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollCheck(0, 10);
      if (result.total >= 10 || result.roll === 20) {
        expect(result.success).toBe(true);
      }
    }
  });

  it("success on natural 20 regardless of dc", () => {
    // Run many iterations — when we get a nat 20, it should always be success
    for (let i = 0; i < ITERATIONS * 10; i++) {
      const result = rollCheck(-100, 999);
      if (result.roll === 20) {
        expect(result.success).toBe(true);
        expect(result.critical).toBe(true);
      }
    }
  });

  it("failure when total < dc and not a natural 20", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollCheck(0, 10);
      if (result.total < 10 && result.roll !== 20) {
        expect(result.success).toBe(false);
      }
    }
  });

  it("critical is true only on natural 20", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollCheck(0, 10);
      expect(result.critical).toBe(result.roll === 20);
    }
  });

  it("fumble is true only on natural 1", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const result = rollCheck(0, 10);
      expect(result.fumble).toBe(result.roll === 1);
    }
  });
});
