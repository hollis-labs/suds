import type { Companion } from "@/lib/types";
import { CLASS_DEFINITIONS, type CharacterClass } from "@/lib/constants";
import { rollCheck, rollDice } from "@/server/game/dice";
import namesData from "@/server/gamedata/names.json";

const CLASSES: CharacterClass[] = [
  "fighter", "wizard", "rogue", "cleric",
  "barbarian", "bard", "druid", "monk",
  "paladin", "ranger", "sorcerer", "warlock",
];

const PERSONALITIES = [
  "gruff but loyal",
  "cheerful and talkative",
  "stoic and silent",
  "sarcastic but reliable",
  "nervous but brave",
  "battle-scarred veteran",
  "eager young adventurer",
  "mysterious wanderer",
];

/**
 * Generate a random NPC adventurer companion scaled to the player's level.
 */
export function generateAdventurer(playerLevel: number): Companion {
  const cls = CLASSES[Math.floor(Math.random() * CLASSES.length)]!;
  const def = CLASS_DEFINITIONS[cls];

  // Adventurer level: playerLevel +/- 1, min 1
  const level = Math.max(1, playerLevel + Math.floor(Math.random() * 3) - 1);

  // Generate name
  const firstNames = namesData.npcFirstNames;
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]!;
  const name = `${firstName} the ${def.name}`;

  // Scale stats from class base
  const hpMax = def.hpDie + Math.floor(level * (def.hpDie / 2 + 1));
  const ac = def.startingAC + Math.floor(level / 4);
  const attack = Math.floor(level * 1.2) + 2;
  const damageDie = Math.min(4 + Math.floor(level / 2) * 2, 12);
  const damageBonus = Math.floor(level / 3);
  const damage = damageBonus > 0 ? `1d${damageDie}+${damageBonus}` : `1d${damageDie}`;

  // Pick abilities unlocked at this level
  const abilities: string[] = [];
  for (const [lvl, abs] of Object.entries(def.abilities)) {
    if (level >= Number(lvl)) {
      abilities.push(...abs);
    }
  }

  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)]!;

  return {
    id: `companion_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    class: cls,
    level,
    hp: hpMax,
    hpMax,
    ac,
    attack,
    damage,
    abilities,
    personality,
  };
}

/**
 * Roll whether an NPC adventurer appears during a flee event.
 * Base 20% chance, slightly higher if player is low HP.
 */
export function rollAdventurerAppearance(playerHpPercent: number): boolean {
  const baseChance = 0.20;
  const lowHpBonus = playerHpPercent < 0.3 ? 0.10 : 0;
  return Math.random() < (baseChance + lowHpBonus);
}

/**
 * Roll whether the NPC adventurer will help fight (vs just wishing luck).
 * 60% chance to help.
 */
export function rollAdventurerHelps(): boolean {
  return Math.random() < 0.60;
}

/**
 * Resolve a companion's attack turn against a monster.
 */
export function resolveCompanionAttack(
  companion: Companion,
  monsters: { name: string; hp: number; hpMax: number; ac: number }[],
  round: number,
): { targetIndex: number; log: { round: number; actor: string; action: string; target?: string; result: string; damage?: number } } {
  // Simple AI: attack lowest HP alive monster
  let targetIndex = -1;
  let lowestHp = Infinity;
  for (let i = 0; i < monsters.length; i++) {
    if (monsters[i]!.hp > 0 && monsters[i]!.hp < lowestHp) {
      lowestHp = monsters[i]!.hp;
      targetIndex = i;
    }
  }

  if (targetIndex === -1) {
    return {
      targetIndex: -1,
      log: { round, actor: companion.name, action: "idle", result: "No targets remaining" },
    };
  }

  const target = monsters[targetIndex]!;
  const check = rollCheck(companion.attack, target.ac);

  if (check.success) {
    let damage = rollDice(companion.damage);
    if (check.critical) damage += rollDice(companion.damage);
    damage = Math.max(1, damage);
    target.hp = Math.max(0, target.hp - damage);

    return {
      targetIndex,
      log: {
        round,
        actor: companion.name,
        action: "attack",
        target: target.name,
        result: check.critical
          ? `CRITICAL! Strikes for ${damage} damage${target.hp <= 0 ? " (defeated)" : ""}`
          : `Hits for ${damage} damage${target.hp <= 0 ? " (defeated)" : ""}`,
        damage,
      },
    };
  }

  return {
    targetIndex,
    log: {
      round,
      actor: companion.name,
      action: "attack",
      target: target.name,
      result: "Misses",
      damage: 0,
    },
  };
}

/**
 * Apply monster damage to a companion (monsters have a chance to target the companion).
 * Returns true if the companion was targeted.
 */
export function shouldTargetCompanion(): boolean {
  // 30% chance monsters target the companion instead of the player
  return Math.random() < 0.30;
}
