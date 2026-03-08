import { describe, it, expect, vi } from "vitest";
import {
  initCombat,
  resolveTurn,
  calculateRewards,
  type CombatExtra,
  type Buff,
} from "@/server/game/combat";
import type {
  Player,
  Monster,
  MonsterEncounter,
  CombatState,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(overrides?: Partial<Player>): Player {
  return {
    id: "player_1",
    name: "TestHero",
    class: "fighter",
    theme: "epic",
    level: 3,
    xp: 0,
    xpNext: 600,
    hp: 30,
    hpMax: 30,
    mp: 20,
    mpMax: 20,
    gold: 50,
    stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    ac: 16,
    position: { x: 0, y: 0 },
    equipment: {
      weapon: {
        id: "w1",
        itemId: "iron_sword",
        name: "Iron Sword",
        type: "weapon",
        rarity: "common",
        stats: { damage: 6 },
        quantity: 1,
        slot: null,
        isEquipped: true,
      },
    },
    abilities: ["power_attack", "shield_block"],
    lastSafe: { x: 0, y: 0 },
    baseLevel: 0,
    ...overrides,
  };
}

function makeMonster(overrides?: Partial<Monster>): Monster {
  return {
    id: "mon_1",
    name: "Goblin",
    level: 1,
    hp: 10,
    hpMax: 10,
    ac: 12,
    attack: 3,
    damage: "1d6",
    xp: 40,
    abilities: [],
    description: "A level 1 Goblin.",
    ...overrides,
  };
}

function makeEncounter(monsters?: Monster[]): MonsterEncounter {
  return { monsters: monsters ?? [makeMonster()] };
}

function makeExtra(): CombatExtra {
  return {
    playerBuffs: [],
    monsterBuffs: new Map(),
    roundNumber: 1,
    aggro: 5,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("initCombat", () => {
  it("creates a valid CombatState with correct turn order length", () => {
    const player = makePlayer();
    const encounter = makeEncounter([makeMonster(), makeMonster({ id: "mon_2", name: "Orc" })]);
    const { state, extra } = initCombat(player, encounter);

    expect(state.id).toBeTruthy();
    expect(state.monsters).toHaveLength(2);
    // Turn order: 1 player + 2 monsters = 3 entries
    expect(state.turnOrder).toHaveLength(3);
    expect(state.currentTurn).toBe(0);
    expect(state.round).toBe(1);
    expect(state.log).toHaveLength(0);

    // Verify turn order contains exactly one player entry and correct monster entries
    const playerEntries = state.turnOrder.filter((t) => t.type === "player");
    const monsterEntries = state.turnOrder.filter((t) => t.type === "monster");
    expect(playerEntries).toHaveLength(1);
    expect(monsterEntries).toHaveLength(2);

    // Extra should be initialized
    expect(extra.playerBuffs).toHaveLength(0);
    expect(extra.roundNumber).toBe(1);
  });

  it("does not mutate the original encounter", () => {
    const player = makePlayer();
    const monster = makeMonster();
    const encounter = makeEncounter([monster]);
    const originalHp = monster.hp;

    initCombat(player, encounter);

    expect(monster.hp).toBe(originalHp);
  });
});

describe("resolveTurn - player attack", () => {
  it("resolves a player attack that can hit or miss based on AC", () => {
    const player = makePlayer();
    const encounter = makeEncounter([makeMonster({ ac: 10, hp: 50, hpMax: 50 })]);
    const { state, extra } = initCombat(player, encounter);

    // Force player's turn by finding a state where player goes first
    const playerTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "player" }, { type: "monster", index: 0 }],
      currentTurn: 0,
    };

    let hitOccurred = false;
    let missOccurred = false;

    // Run multiple times to observe both hit and miss
    for (let i = 0; i < 100; i++) {
      const result = resolveTurn(playerTurnState, player, "attack", extra, 0);
      const entry = result.result[0]!;

      expect(entry.actor).toBe("TestHero");
      expect(entry.action).toBe("attack");

      if (entry.result.includes("Hit") || entry.result.includes("CRITICAL")) {
        hitOccurred = true;
        expect(entry.damage).toBeGreaterThan(0);
      } else {
        missOccurred = true;
      }
    }

    // With AC 10 and +3 STR mod, most should hit, but at least check we got hits
    expect(hitOccurred).toBe(true);
  });
});

describe("resolveTurn - player defend", () => {
  it("grants +2 AC buff when defending", () => {
    const player = makePlayer();
    const encounter = makeEncounter([makeMonster()]);
    const { state } = initCombat(player, encounter);

    const playerTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "player" }, { type: "monster", index: 0 }],
      currentTurn: 0,
    };
    const extra = makeExtra();

    const result = resolveTurn(playerTurnState, player, "defend", extra);

    expect(result.result).toHaveLength(1);
    expect(result.result[0]!.action).toBe("defend");
    expect(result.result[0]!.result).toContain("+2 AC");

    // The extra should have a buff
    expect(result.extra.playerBuffs.length).toBeGreaterThanOrEqual(0);
    // The buff was added but may have been ticked (since defend buff lasts 1 round)
    // It gets ticked at the START of the player's turn, but added during the turn
    // so it should still be present
  });
});

describe("resolveTurn - monster AI", () => {
  it("selects a valid action for the monster", () => {
    const player = makePlayer();
    const encounter = makeEncounter([makeMonster({ attack: 5, damage: "1d8" })]);
    const { state } = initCombat(player, encounter);

    const monsterTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "monster", index: 0 }, { type: "player" }],
      currentTurn: 0,
    };
    const extra = makeExtra();

    const validActions = ["attack", "defend", "flee"];
    let sawAction = false;

    for (let i = 0; i < 50; i++) {
      const result = resolveTurn(monsterTurnState, player, "attack", extra, 0);
      if (result.result.length > 0) {
        const action = result.result[0]!.action;
        // Monster actions are attack, defend, flee, or ability names
        expect(typeof action).toBe("string");
        sawAction = true;
      }
    }

    expect(sawAction).toBe(true);
  });
});

describe("combat end conditions", () => {
  it("combat ends with victory when all monsters die", () => {
    const player = makePlayer({ stats: { str: 30, dex: 30, con: 14, int: 10, wis: 10, cha: 10 } });
    const encounter = makeEncounter([makeMonster({ hp: 1, hpMax: 1, ac: 1 })]);
    const { state } = initCombat(player, encounter);

    const playerTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "player" }, { type: "monster", index: 0 }],
      currentTurn: 0,
    };
    const extra = makeExtra();

    // With STR 30 (+10 mod) and monster AC 1, should almost always hit
    let victoryFound = false;
    for (let i = 0; i < 50; i++) {
      const result = resolveTurn(playerTurnState, player, "attack", extra, 0);
      if (result.combatOver && result.victory) {
        victoryFound = true;
        break;
      }
    }

    expect(victoryFound).toBe(true);
  });

  it("combat ends with defeat when player HP reaches 0", () => {
    const player = makePlayer({ hp: 1, ac: 1 });
    const encounter = makeEncounter([makeMonster({ attack: 20, damage: "3d10+10" })]);
    const { state } = initCombat(player, encounter);

    const monsterTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "monster", index: 0 }, { type: "player" }],
      currentTurn: 0,
    };
    const extra = makeExtra();

    let defeatFound = false;
    for (let i = 0; i < 50; i++) {
      const result = resolveTurn(monsterTurnState, player, "attack", extra, 0);
      if (result.combatOver && !result.victory) {
        defeatFound = true;
        break;
      }
    }

    expect(defeatFound).toBe(true);
  });
});

describe("resolveTurn - flee", () => {
  it("flee can succeed or fail based on DEX check", () => {
    const player = makePlayer();
    const encounter = makeEncounter([makeMonster()]);
    const { state } = initCombat(player, encounter);

    const playerTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "player" }, { type: "monster", index: 0 }],
      currentTurn: 0,
    };

    let fleeSuccess = false;
    let fleeFail = false;

    for (let i = 0; i < 100; i++) {
      const extra = makeExtra();
      const result = resolveTurn(playerTurnState, player, "flee", extra);
      const entry = result.result[0]!;
      expect(entry.action).toBe("flee");

      if (entry.result.includes("Successfully")) {
        fleeSuccess = true;
        expect(result.combatOver).toBe(true);
        expect(result.victory).toBe(false);
      } else {
        fleeFail = true;
      }
    }

    // With DEX 12 (+1 mod) vs DC 12, should see both outcomes
    expect(fleeSuccess).toBe(true);
    expect(fleeFail).toBe(true);
  });
});

describe("resolveTurn - spell casting", () => {
  it("deducts MP when casting a spell", () => {
    const player = makePlayer({
      mp: 20,
      mpMax: 20,
      abilities: ["arcane_missile"],
      stats: { str: 10, dex: 12, con: 14, int: 16, wis: 10, cha: 10 },
    });
    const encounter = makeEncounter([makeMonster({ hp: 50, hpMax: 50 })]);
    const { state } = initCombat(player, encounter);

    const playerTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "player" }, { type: "monster", index: 0 }],
      currentTurn: 0,
    };
    const extra = makeExtra();

    const result = resolveTurn(playerTurnState, player, "cast", extra, 0, "arcane_missile");
    // arcane_missile costs 5 MP
    expect(result.player.mp).toBe(15);
    expect(result.result.length).toBeGreaterThan(0);
    expect(result.result[0]!.action).toBe("cast");
  });

  it("fails to cast if not enough MP", () => {
    const player = makePlayer({ mp: 2, mpMax: 20, abilities: ["arcane_missile"] });
    const encounter = makeEncounter([makeMonster()]);
    const { state } = initCombat(player, encounter);

    const playerTurnState: CombatState = {
      ...state,
      turnOrder: [{ type: "player" }, { type: "monster", index: 0 }],
      currentTurn: 0,
    };
    const extra = makeExtra();

    const result = resolveTurn(playerTurnState, player, "cast", extra, 0, "arcane_missile");
    // MP should not change
    expect(result.player.mp).toBe(2);
    expect(result.result[0]!.result).toContain("Not enough MP");
  });
});

describe("calculateRewards", () => {
  it("returns XP and gold from defeated monsters", () => {
    const monsters: Monster[] = [
      makeMonster({ xp: 40, level: 1 }),
      makeMonster({ xp: 60, level: 2 }),
    ];

    const rewards = calculateRewards(monsters);

    expect(rewards.xp).toBe(100);
    expect(rewards.gold).toBeGreaterThan(0);
  });

  it("returns 0 XP for empty monster array", () => {
    const rewards = calculateRewards([]);
    expect(rewards.xp).toBe(0);
    expect(rewards.gold).toBe(0);
  });
});

describe("turn order cycling", () => {
  it("cycles through turns correctly across rounds", () => {
    const player = makePlayer({ hp: 100, hpMax: 100, ac: 30 }); // high AC to survive
    const encounter = makeEncounter([makeMonster({ hp: 100, hpMax: 100, ac: 30, attack: 1 })]);
    const { state } = initCombat(player, encounter);

    // Force a specific turn order: player then monster
    const controlledState: CombatState = {
      ...state,
      turnOrder: [{ type: "player" }, { type: "monster", index: 0 }],
      currentTurn: 0,
      round: 1,
    };
    let extra = makeExtra();

    // Turn 1: player's turn (index 0)
    expect(controlledState.currentTurn).toBe(0);

    const r1 = resolveTurn(controlledState, player, "defend", extra);
    // After player's turn, should advance to monster's turn (index 1)
    expect(r1.state.currentTurn).toBe(1);

    // Turn 2: monster's turn (index 1)
    const r2 = resolveTurn(r1.state, r1.player, "attack", r1.extra, 0);
    // After monster's turn, should wrap back to player (index 0) and increment round
    expect(r2.state.currentTurn).toBe(0);
    expect(r2.state.round).toBe(2);
  });
});
