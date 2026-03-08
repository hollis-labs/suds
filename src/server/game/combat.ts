import type {
  Player,
  Monster,
  Companion,
  MonsterEncounter,
  CombatState,
  CombatLogEntry,
  CombatAction,
  GameItem,
} from "@/lib/types";
import { statModifier } from "@/lib/constants";
import { roll, rollMultiple, rollDice, rollD20, rollCheck } from "@/server/game/dice";

// ---------------------------------------------------------------------------
// Buff system
// ---------------------------------------------------------------------------

export interface Buff {
  name: string;
  acBonus?: number;
  attackBonus?: number;
  damageBonus?: number;
  damageAbsorb?: number;
  roundsRemaining: number;
}

export interface CombatExtra {
  playerBuffs: Buff[];
  monsterBuffs: Map<number, Buff[]>; // keyed by monster index
  roundNumber: number;
  aggro: number; // 0-10, affects chase rolls. Starts at monster level avg, cools each flee.
}

function createCombatExtra(): CombatExtra {
  return {
    playerBuffs: [],
    monsterBuffs: new Map(),
    roundNumber: 1,
    aggro: 5,
  };
}

function cloneCombatExtra(extra: CombatExtra): CombatExtra {
  const monsterBuffs = new Map<number, Buff[]>();
  for (const [k, v] of extra.monsterBuffs) {
    monsterBuffs.set(k, v.map((b) => ({ ...b })));
  }
  return {
    playerBuffs: extra.playerBuffs.map((b) => ({ ...b })),
    monsterBuffs,
    roundNumber: extra.roundNumber,
    aggro: extra.aggro,
  };
}

/**
 * Roll chase check for each alive monster.
 * Chase DC = 10. Roll = d20 + aggro modifier.
 * Returns array of monster indexes that give chase.
 */
export function rollChase(
  monsters: Monster[],
  aggro: number
): { chasers: number[]; aggroAfter: number } {
  const chasers: number[] = [];
  for (let i = 0; i < monsters.length; i++) {
    if (monsters[i]!.hp <= 0) continue;
    const chaseRoll = rollD20() + Math.floor(aggro / 2);
    if (chaseRoll >= 10) {
      chasers.push(i);
    }
  }
  // Aggro cools by 2 each flee attempt (min 0)
  const aggroAfter = Math.max(0, aggro - 2);
  return { chasers, aggroAfter };
}

function getPlayerACBonus(extra: CombatExtra): number {
  return extra.playerBuffs.reduce((sum, b) => sum + (b.acBonus ?? 0), 0);
}

function getPlayerAttackBonus(extra: CombatExtra): number {
  return extra.playerBuffs.reduce((sum, b) => sum + (b.attackBonus ?? 0), 0);
}

function getPlayerDamageBonus(extra: CombatExtra): number {
  return extra.playerBuffs.reduce((sum, b) => sum + (b.damageBonus ?? 0), 0);
}

function getPlayerDamageAbsorb(extra: CombatExtra): number {
  return extra.playerBuffs.reduce((sum, b) => sum + (b.damageAbsorb ?? 0), 0);
}

function absorbDamage(extra: CombatExtra, damage: number): { absorbed: number; remaining: number } {
  let remaining = damage;
  for (const buff of extra.playerBuffs) {
    if (buff.damageAbsorb && buff.damageAbsorb > 0 && remaining > 0) {
      const absorb = Math.min(buff.damageAbsorb, remaining);
      buff.damageAbsorb -= absorb;
      remaining -= absorb;
      if (buff.damageAbsorb <= 0) {
        buff.roundsRemaining = 0; // expired
      }
    }
  }
  return { absorbed: damage - remaining, remaining };
}

function getMonsterACBonus(extra: CombatExtra, monsterIndex: number): number {
  const buffs = extra.monsterBuffs.get(monsterIndex) ?? [];
  return buffs.reduce((sum, b) => sum + (b.acBonus ?? 0), 0);
}

function tickBuffs(buffs: Buff[]): Buff[] {
  return buffs
    .map((b) => ({ ...b, roundsRemaining: b.roundsRemaining - 1 }))
    .filter((b) => b.roundsRemaining > 0);
}

// ---------------------------------------------------------------------------
// Ability definitions
// ---------------------------------------------------------------------------

interface AbilityDef {
  mpCost: number;
  targetType: "single" | "all" | "self" | "multi";
  maxTargets?: number;
  resolve: (
    player: Player,
    monsters: Monster[],
    targetIndex: number | undefined,
    extra: CombatExtra
  ) => { damage?: number; heal?: number; log: string; affectedIndexes: number[]; buffAdded?: Buff; hitPenalty?: number; selfDamage?: number; mpRestore?: number };
}

const ABILITY_DEFS: Record<string, AbilityDef> = {
  arcane_missile: {
    mpCost: 5,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const intMod = statModifier(player.stats.int);
      const damage = roll(4) + intMod;
      return {
        damage: Math.max(0, damage),
        log: `Arcane Missile hits for ${Math.max(0, damage)} damage (auto-hit)`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  fireball: {
    mpCost: 10,
    targetType: "all",
    resolve: (player, monsters) => {
      const intMod = statModifier(player.stats.int);
      const damage = rollMultiple(2, 6).reduce((a, b) => a + b, 0) + intMod;
      const indexes = monsters.map((_, i) => i).filter((i) => monsters[i]!.hp > 0);
      return {
        damage: Math.max(0, damage),
        log: `Fireball hits all enemies for ${Math.max(0, damage)} damage`,
        affectedIndexes: indexes,
      };
    },
  },
  heal: {
    mpCost: 8,
    targetType: "self",
    resolve: (player) => {
      const wisMod = statModifier(player.stats.wis);
      const heal = rollMultiple(2, 8).reduce((a, b) => a + b, 0) + wisMod;
      return {
        heal: Math.max(0, heal),
        log: `Heal restores ${Math.max(0, heal)} HP`,
        affectedIndexes: [],
      };
    },
  },
  smite: {
    mpCost: 5,
    targetType: "single",
    resolve: (player, monsters, targetIndex) => {
      const wisMod = statModifier(player.stats.wis);
      let damage = rollMultiple(2, 6).reduce((a, b) => a + b, 0) + wisMod;
      const target = monsters[targetIndex ?? 0];
      // bonus vs undead - check name for undead-like monsters
      const undeadNames = ["skeleton", "zombie", "ghoul", "wraith", "mummy", "lich", "death knight", "vampire"];
      if (target && undeadNames.some((n) => target.name.toLowerCase().includes(n))) {
        damage += rollMultiple(2, 6).reduce((a, b) => a + b, 0);
      }
      return {
        damage: Math.max(0, damage),
        log: `Smite deals ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  sneak_attack: {
    mpCost: 0,
    targetType: "single",
    resolve: (player, _monsters, targetIndex, extra) => {
      if (extra.roundNumber > 1) {
        return {
          damage: 0,
          log: "Sneak Attack failed - only works on the first round!",
          affectedIndexes: [],
        };
      }
      const dexMod = statModifier(player.stats.dex);
      const damage = rollMultiple(2, 6).reduce((a, b) => a + b, 0) + dexMod;
      return {
        damage: Math.max(0, damage),
        log: `Sneak Attack hits for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  power_attack: {
    mpCost: 0,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const strMod = statModifier(player.stats.str);
      const weaponDamage = player.equipment.weapon?.stats?.damage ?? 4;
      const damage = roll(weaponDamage) + strMod + 4;
      return {
        damage: Math.max(0, damage),
        log: `Power Attack deals ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
        hitPenalty: -2,
      };
    },
  },
  shield_block: {
    mpCost: 0,
    targetType: "self",
    resolve: () => {
      return {
        log: "Shield Block grants +4 AC until next turn",
        affectedIndexes: [],
        buffAdded: { name: "shield_block", acBonus: 4, roundsRemaining: 1 },
      };
    },
  },
  ice_shield: {
    mpCost: 8,
    targetType: "self",
    resolve: () => {
      return {
        log: "Ice Shield grants +3 AC for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "ice_shield", acBonus: 3, roundsRemaining: 3 },
      };
    },
  },
  chain_lightning: {
    mpCost: 15,
    targetType: "multi",
    maxTargets: 3,
    resolve: (player, monsters) => {
      const intMod = statModifier(player.stats.int);
      const alive = monsters.map((_, i) => i).filter((i) => monsters[i]!.hp > 0);
      const targets = alive.slice(0, 3);
      const damage = roll(8) + intMod;
      return {
        damage: Math.max(0, damage),
        log: `Chain Lightning hits ${targets.length} target(s) for ${Math.max(0, damage)} damage each`,
        affectedIndexes: targets,
      };
    },
  },
  cleave: {
    mpCost: 5,
    targetType: "multi",
    maxTargets: 2,
    resolve: (player, monsters) => {
      const weaponDamage = player.equipment.weapon?.stats?.damage ?? 4;
      const damage = roll(weaponDamage);
      const alive = monsters.map((_, i) => i).filter((i) => monsters[i]!.hp > 0);
      const targets = alive.slice(0, 2);
      return {
        damage: Math.max(0, damage),
        log: `Cleave hits ${targets.length} target(s) for ${Math.max(0, damage)} damage each`,
        affectedIndexes: targets,
      };
    },
  },
  dodge: {
    mpCost: 0,
    targetType: "self",
    resolve: () => {
      return {
        log: "Dodge grants +4 AC until next turn",
        affectedIndexes: [],
        buffAdded: { name: "dodge", acBonus: 4, roundsRemaining: 1 },
      };
    },
  },
  assassinate: {
    mpCost: 10,
    targetType: "single",
    resolve: (player, _monsters, targetIndex, extra) => {
      if (extra.roundNumber > 1) {
        return {
          damage: 0,
          log: "Assassinate failed - only works on the first round!",
          affectedIndexes: [],
        };
      }
      const dexMod = statModifier(player.stats.dex);
      const damage = rollMultiple(3, 6).reduce((a, b) => a + b, 0) + dexMod;
      return {
        damage: Math.max(0, damage),
        log: `Assassinate strikes for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  bless: {
    mpCost: 10,
    targetType: "self",
    resolve: () => {
      return {
        log: "Bless grants +2 to attack rolls for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "bless", attackBonus: 2, roundsRemaining: 3 },
      };
    },
  },
  divine_shield: {
    mpCost: 12,
    targetType: "self",
    resolve: () => {
      return {
        log: "Divine Shield absorbs the next 20 damage",
        affectedIndexes: [],
        buffAdded: { name: "divine_shield", damageAbsorb: 20, roundsRemaining: 99 },
      };
    },
  },
  pick_lock: {
    mpCost: 0,
    targetType: "self",
    resolve: () => {
      return {
        log: "Pick Lock is not a combat ability!",
        affectedIndexes: [],
      };
    },
  },
  battle_cry: {
    mpCost: 0,
    targetType: "self",
    resolve: () => {
      return {
        log: "Battle Cry grants +2 attack and +1 damage for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "battle_cry", attackBonus: 2, damageBonus: 1, roundsRemaining: 3 },
      };
    },
  },

  // --- Barbarian abilities ---
  rage: {
    mpCost: 0,
    targetType: "self",
    resolve: () => {
      return {
        log: "Rage! +3 damage and +1 AC for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "rage", damageBonus: 3, acBonus: 1, roundsRemaining: 3 },
      };
    },
  },
  reckless_attack: {
    mpCost: 0,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const strMod = statModifier(player.stats.str);
      const weaponDamage = player.equipment.weapon?.stats?.damage ?? 6;
      const damage = roll(weaponDamage) + strMod + 2;
      return {
        damage: Math.max(0, damage),
        log: `Reckless Attack deals ${Math.max(0, damage)} damage (grants enemies +2 to hit you)`,
        affectedIndexes: [targetIndex ?? 0],
        hitPenalty: 2, // positive = bonus to hit, offset by granting enemies advantage
      };
    },
  },
  brutal_critical: {
    mpCost: 0,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const strMod = statModifier(player.stats.str);
      const weaponDamage = player.equipment.weapon?.stats?.damage ?? 6;
      // Triple damage dice
      const damage = roll(weaponDamage) + roll(weaponDamage) + roll(weaponDamage) + strMod;
      return {
        damage: Math.max(0, damage),
        log: `Brutal Critical smashes for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
        hitPenalty: -1,
      };
    },
  },
  relentless_endurance: {
    mpCost: 0,
    targetType: "self",
    resolve: (player) => {
      const conMod = statModifier(player.stats.con);
      const heal = roll(12) + conMod + player.level;
      return {
        heal: Math.max(1, heal),
        log: `Relentless Endurance restores ${Math.max(1, heal)} HP through sheer willpower`,
        affectedIndexes: [],
      };
    },
  },

  // --- Bard abilities ---
  bardic_inspiration: {
    mpCost: 5,
    targetType: "self",
    resolve: () => {
      return {
        log: "Bardic Inspiration grants +2 attack and +2 AC for 2 rounds",
        affectedIndexes: [],
        buffAdded: { name: "bardic_inspiration", attackBonus: 2, acBonus: 2, roundsRemaining: 2 },
      };
    },
  },
  cutting_words: {
    mpCost: 5,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const chaMod = statModifier(player.stats.cha);
      const damage = roll(8) + chaMod;
      return {
        damage: Math.max(0, damage),
        log: `Cutting Words lashes for ${Math.max(0, damage)} psychic damage (auto-hit)`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  healing_word: {
    mpCost: 8,
    targetType: "self",
    resolve: (player) => {
      const chaMod = statModifier(player.stats.cha);
      const heal = rollMultiple(2, 6).reduce((a, b) => a + b, 0) + chaMod;
      return {
        heal: Math.max(1, heal),
        log: `Healing Word restores ${Math.max(1, heal)} HP`,
        affectedIndexes: [],
      };
    },
  },
  mass_inspiration: {
    mpCost: 12,
    targetType: "self",
    resolve: () => {
      return {
        log: "Mass Inspiration grants +3 attack, +2 damage, and +2 AC for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "mass_inspiration", attackBonus: 3, damageBonus: 2, acBonus: 2, roundsRemaining: 3 },
      };
    },
  },

  // --- Druid abilities ---
  entangle: {
    mpCost: 5,
    targetType: "all",
    resolve: (player, monsters) => {
      const wisMod = statModifier(player.stats.wis);
      const damage = roll(6) + wisMod;
      const indexes = monsters.map((_, i) => i).filter((i) => monsters[i]!.hp > 0);
      return {
        damage: Math.max(0, damage),
        log: `Entangle ensnares all enemies for ${Math.max(0, damage)} damage`,
        affectedIndexes: indexes,
      };
    },
  },
  thunderwave: {
    mpCost: 8,
    targetType: "all",
    resolve: (player, monsters) => {
      const wisMod = statModifier(player.stats.wis);
      const damage = rollMultiple(2, 6).reduce((a, b) => a + b, 0) + wisMod;
      const indexes = monsters.map((_, i) => i).filter((i) => monsters[i]!.hp > 0);
      return {
        damage: Math.max(0, damage),
        log: `Thunderwave blasts all enemies for ${Math.max(0, damage)} damage`,
        affectedIndexes: indexes,
      };
    },
  },
  call_lightning: {
    mpCost: 12,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const wisMod = statModifier(player.stats.wis);
      const damage = rollMultiple(3, 10).reduce((a, b) => a + b, 0) + wisMod;
      return {
        damage: Math.max(0, damage),
        log: `Call Lightning strikes for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  regenerate: {
    mpCost: 10,
    targetType: "self",
    resolve: (player) => {
      const wisMod = statModifier(player.stats.wis);
      const heal = rollMultiple(3, 8).reduce((a, b) => a + b, 0) + wisMod;
      return {
        heal: Math.max(1, heal),
        log: `Regenerate restores ${Math.max(1, heal)} HP`,
        affectedIndexes: [],
      };
    },
  },

  // --- Monk abilities ---
  flurry_of_blows: {
    mpCost: 3,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const dexMod = statModifier(player.stats.dex);
      // Two rapid strikes
      const damage = roll(6) + roll(6) + dexMod;
      return {
        damage: Math.max(0, damage),
        log: `Flurry of Blows strikes twice for ${Math.max(0, damage)} total damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  patient_defense: {
    mpCost: 2,
    targetType: "self",
    resolve: () => {
      return {
        log: "Patient Defense grants +4 AC until next turn",
        affectedIndexes: [],
        buffAdded: { name: "patient_defense", acBonus: 4, roundsRemaining: 1 },
      };
    },
  },
  stunning_strike: {
    mpCost: 5,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const dexMod = statModifier(player.stats.dex);
      const wisMod = statModifier(player.stats.wis);
      const damage = rollMultiple(2, 8).reduce((a, b) => a + b, 0) + dexMod + wisMod;
      return {
        damage: Math.max(0, damage),
        log: `Stunning Strike hits for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  quivering_palm: {
    mpCost: 12,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const dexMod = statModifier(player.stats.dex);
      const damage = rollMultiple(4, 8).reduce((a, b) => a + b, 0) + dexMod;
      return {
        damage: Math.max(0, damage),
        log: `Quivering Palm delivers a devastating blow for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },

  // --- Paladin abilities ---
  divine_smite_paladin: {
    mpCost: 5,
    targetType: "single",
    resolve: (player, monsters, targetIndex) => {
      const strMod = statModifier(player.stats.str);
      let damage = rollMultiple(2, 8).reduce((a, b) => a + b, 0) + strMod;
      const target = monsters[targetIndex ?? 0];
      const undeadNames = ["skeleton", "zombie", "ghoul", "wraith", "mummy", "lich", "death knight", "vampire"];
      if (target && undeadNames.some((n) => target.name.toLowerCase().includes(n))) {
        damage += roll(8);
      }
      return {
        damage: Math.max(0, damage),
        log: `Divine Smite deals ${Math.max(0, damage)} radiant damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  lay_on_hands: {
    mpCost: 8,
    targetType: "self",
    resolve: (player) => {
      const chaMod = statModifier(player.stats.cha);
      const heal = rollMultiple(3, 8).reduce((a, b) => a + b, 0) + chaMod;
      return {
        heal: Math.max(1, heal),
        log: `Lay on Hands restores ${Math.max(1, heal)} HP`,
        affectedIndexes: [],
      };
    },
  },
  aura_of_protection: {
    mpCost: 8,
    targetType: "self",
    resolve: () => {
      return {
        log: "Aura of Protection grants +2 AC and +2 attack for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "aura_of_protection", acBonus: 2, attackBonus: 2, roundsRemaining: 3 },
      };
    },
  },
  holy_avenger: {
    mpCost: 12,
    targetType: "single",
    resolve: (player, monsters, targetIndex) => {
      const strMod = statModifier(player.stats.str);
      let damage = rollMultiple(3, 8).reduce((a, b) => a + b, 0) + strMod;
      const target = monsters[targetIndex ?? 0];
      const undeadNames = ["skeleton", "zombie", "ghoul", "wraith", "mummy", "lich", "death knight", "vampire"];
      if (target && undeadNames.some((n) => target.name.toLowerCase().includes(n))) {
        damage += rollMultiple(2, 8).reduce((a, b) => a + b, 0);
      }
      return {
        damage: Math.max(0, damage),
        log: `Holy Avenger strikes for ${Math.max(0, damage)} radiant damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },

  // --- Ranger abilities ---
  hunters_mark: {
    mpCost: 3,
    targetType: "self",
    resolve: () => {
      return {
        log: "Hunter's Mark grants +2 damage for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "hunters_mark", damageBonus: 2, roundsRemaining: 3 },
      };
    },
  },
  multiattack: {
    mpCost: 5,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const dexMod = statModifier(player.stats.dex);
      const weaponDamage = player.equipment.weapon?.stats?.damage ?? 6;
      const damage = roll(weaponDamage) + roll(weaponDamage) + dexMod;
      return {
        damage: Math.max(0, damage),
        log: `Multiattack hits twice for ${Math.max(0, damage)} total damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  evasion: {
    mpCost: 5,
    targetType: "self",
    resolve: () => {
      return {
        log: "Evasion grants +5 AC until next turn",
        affectedIndexes: [],
        buffAdded: { name: "evasion", acBonus: 5, roundsRemaining: 1 },
      };
    },
  },
  volley: {
    mpCost: 10,
    targetType: "all",
    resolve: (player, monsters) => {
      const dexMod = statModifier(player.stats.dex);
      const weaponDamage = player.equipment.weapon?.stats?.damage ?? 6;
      const damage = roll(weaponDamage) + dexMod;
      const indexes = monsters.map((_, i) => i).filter((i) => monsters[i]!.hp > 0);
      return {
        damage: Math.max(0, damage),
        log: `Volley rains arrows on all enemies for ${Math.max(0, damage)} damage each`,
        affectedIndexes: indexes,
      };
    },
  },

  // --- Sorcerer abilities ---
  chaos_bolt: {
    mpCost: 5,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const chaMod = statModifier(player.stats.cha);
      const damage = rollMultiple(2, 8).reduce((a, b) => a + b, 0) + chaMod;
      return {
        damage: Math.max(0, damage),
        log: `Chaos Bolt crackles with wild energy for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  shield_spell: {
    mpCost: 3,
    targetType: "self",
    resolve: () => {
      return {
        log: "Shield grants +5 AC until next turn",
        affectedIndexes: [],
        buffAdded: { name: "shield_spell", acBonus: 5, roundsRemaining: 1 },
      };
    },
  },
  metamagic_blast: {
    mpCost: 12,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const chaMod = statModifier(player.stats.cha);
      const damage = rollMultiple(3, 10).reduce((a, b) => a + b, 0) + chaMod;
      return {
        damage: Math.max(0, damage),
        log: `Metamagic Blast unleashes ${Math.max(0, damage)} empowered damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  wild_surge: {
    mpCost: 15,
    targetType: "all",
    resolve: (player, monsters) => {
      const chaMod = statModifier(player.stats.cha);
      const damage = rollMultiple(2, 8).reduce((a, b) => a + b, 0) + chaMod + roll(6);
      const indexes = monsters.map((_, i) => i).filter((i) => monsters[i]!.hp > 0);
      return {
        damage: Math.max(0, damage),
        log: `Wild Surge erupts chaotically for ${Math.max(0, damage)} damage to all enemies`,
        affectedIndexes: indexes,
      };
    },
  },

  // --- Warlock abilities ---
  eldritch_blast: {
    mpCost: 0,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const chaMod = statModifier(player.stats.cha);
      const damage = roll(10) + chaMod;
      return {
        damage: Math.max(0, damage),
        log: `Eldritch Blast hits for ${Math.max(0, damage)} force damage (auto-hit)`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  hex: {
    mpCost: 3,
    targetType: "self",
    resolve: () => {
      return {
        log: "Hex curses the enemy, granting +2 damage for 3 rounds",
        affectedIndexes: [],
        buffAdded: { name: "hex", damageBonus: 2, roundsRemaining: 3 },
      };
    },
  },
  hellfire: {
    mpCost: 8,
    targetType: "single",
    resolve: (player, _monsters, targetIndex) => {
      const chaMod = statModifier(player.stats.cha);
      const damage = rollMultiple(3, 6).reduce((a, b) => a + b, 0) + chaMod;
      return {
        damage: Math.max(0, damage),
        log: `Hellfire scorches for ${Math.max(0, damage)} damage`,
        affectedIndexes: [targetIndex ?? 0],
      };
    },
  },
  dark_pact: {
    mpCost: 0,
    targetType: "self",
    resolve: (player) => {
      const hpCost = Math.floor(player.hpMax * 0.25);
      const mpRestore = player.mpMax - player.mp;
      return {
        selfDamage: hpCost,
        mpRestore,
        log: `Dark Pact sacrifices ${hpCost} HP to restore ${mpRestore} MP`,
        affectedIndexes: [],
      };
    },
  },
};

// ---------------------------------------------------------------------------
// Init combat
// ---------------------------------------------------------------------------

function generateCombatId(): string {
  return `combat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function initCombat(
  player: Player,
  encounter: MonsterEncounter,
  companion?: Companion | null,
): { state: CombatState; extra: CombatExtra } {
  const dexMod = statModifier(player.stats.dex);
  const playerInit = rollD20() + dexMod;

  const initiatives: { type: "player" | "monster" | "companion"; index?: number; init: number }[] = [
    { type: "player", init: playerInit },
  ];

  // Add companion to initiative if present and alive
  if (companion && companion.hp > 0) {
    const companionInit = rollD20() + Math.floor(companion.attack / 3);
    initiatives.push({ type: "companion", init: companionInit });
  }

  encounter.monsters.forEach((monster, i) => {
    const monsterDexApprox = Math.floor(monster.attack / 3);
    const monsterInit = rollD20() + monsterDexApprox;
    initiatives.push({ type: "monster", index: i, init: monsterInit });
  });

  // Sort by initiative descending (highest goes first)
  initiatives.sort((a, b) => b.init - a.init);

  const turnOrder = initiatives.map(({ type, index }) => {
    if (type === "player") return { type: "player" as const };
    if (type === "companion") return { type: "companion" as const };
    return { type: "monster" as const, index };
  });

  const state: CombatState = {
    id: generateCombatId(),
    monsters: encounter.monsters.map((m) => ({ ...m })),
    companion: companion && companion.hp > 0 ? { ...companion } : null,
    turnOrder,
    currentTurn: 0,
    round: 1,
    log: [],
  };

  const extra = createCombatExtra();
  // Initial aggro = average monster level, clamped 2-8
  const avgLevel = encounter.monsters.reduce((s, m) => s + m.level, 0) / encounter.monsters.length;
  extra.aggro = Math.min(8, Math.max(2, Math.round(avgLevel)));

  return { state, extra };
}

// ---------------------------------------------------------------------------
// Resolve turn
// ---------------------------------------------------------------------------

export function resolveTurn(
  state: CombatState,
  player: Player,
  action: CombatAction,
  extra: CombatExtra,
  targetIndex?: number,
  itemId?: string
): {
  state: CombatState;
  player: Player;
  extra: CombatExtra;
  result: CombatLogEntry[];
  combatOver: boolean;
  victory: boolean;
} {
  // Deep clone to avoid mutation
  const newState: CombatState = {
    ...state,
    monsters: state.monsters.map((m) => ({ ...m })),
    companion: state.companion ? { ...state.companion } : null,
    turnOrder: state.turnOrder.map((t) => ({ ...t })),
    log: [...state.log],
  };
  const newPlayer: Player = {
    ...player,
    stats: { ...player.stats },
    equipment: { ...player.equipment },
    position: { ...player.position },
    lastSafe: { ...player.lastSafe },
  };
  const newExtra = cloneCombatExtra(extra);
  const result: CombatLogEntry[] = [];

  const currentTurnEntry = newState.turnOrder[newState.currentTurn];
  if (!currentTurnEntry) {
    return { state: newState, player: newPlayer, extra: newExtra, result, combatOver: false, victory: false };
  }

  if (currentTurnEntry.type === "player") {
    resolvePlayerTurn(newState, newPlayer, newExtra, action, targetIndex, itemId, result);
  } else if (currentTurnEntry.type === "companion") {
    resolveCompanionTurn(newState, newPlayer, newExtra, result);
  } else {
    resolveMonsterTurn(newState, newPlayer, newExtra, currentTurnEntry.index!, result);
  }

  // Advance turn
  advanceTurn(newState, newExtra);

  // Check combat over
  const fled = newState.round === -1;
  const allMonstersDead = newState.monsters.every((m) => m.hp <= 0);
  const playerDead = newPlayer.hp <= 0;
  const combatOver = fled || allMonstersDead || playerDead;
  const victory = allMonstersDead && !playerDead && !fled;

  // Add results to combat log
  newState.log.push(...result);

  return { state: newState, player: newPlayer, extra: newExtra, result, combatOver, victory };
}

// ---------------------------------------------------------------------------
// Player turn resolution
// ---------------------------------------------------------------------------

function resolvePlayerTurn(
  state: CombatState,
  player: Player,
  extra: CombatExtra,
  action: CombatAction,
  targetIndex: number | undefined,
  itemId: string | undefined,
  result: CombatLogEntry[]
): void {
  // Tick player buffs at start of their turn (those with 1 remaining expire)
  extra.playerBuffs = tickBuffs(extra.playerBuffs);

  const resolvedTarget = targetIndex ?? findFirstAliveMonster(state.monsters);

  switch (action) {
    case "attack":
      resolvePlayerAttack(state, player, extra, resolvedTarget, result);
      break;
    case "defend":
      resolvePlayerDefend(state, player, extra, result);
      break;
    case "cast":
      resolvePlayerCast(state, player, extra, itemId, resolvedTarget, result);
      break;
    case "flee":
      resolvePlayerFlee(state, player, result);
      break;
    case "use_item":
      resolvePlayerUseItem(state, player, itemId, result);
      break;
  }
}

function findFirstAliveMonster(monsters: Monster[]): number {
  const idx = monsters.findIndex((m) => m.hp > 0);
  return idx >= 0 ? idx : 0;
}

function resolvePlayerAttack(
  state: CombatState,
  player: Player,
  extra: CombatExtra,
  targetIndex: number,
  result: CombatLogEntry[]
): void {
  const target = state.monsters[targetIndex];
  if (!target || target.hp <= 0) return;

  // Determine if melee or ranged based on weapon type (default melee)
  const strMod = statModifier(player.stats.str);
  const attackMod = strMod + getPlayerAttackBonus(extra);
  const monsterAC = target.ac + getMonsterACBonus(extra, targetIndex);

  const check = rollCheck(attackMod, monsterAC);

  if (check.success) {
    const weaponDamage = player.equipment.weapon?.stats?.damage ?? 4;
    let damage = roll(weaponDamage) + strMod + getPlayerDamageBonus(extra);
    if (check.critical) {
      // Crit = double dice (add another roll)
      damage += roll(weaponDamage);
    }
    damage = Math.max(1, damage);
    target.hp = Math.max(0, target.hp - damage);

    result.push({
      round: state.round,
      actor: player.name,
      action: "attack",
      target: target.name,
      result: check.critical
        ? `CRITICAL HIT! Deals ${damage} damage${target.hp <= 0 ? " (defeated)" : ""}`
        : `Hit for ${damage} damage${target.hp <= 0 ? " (defeated)" : ""}`,
      damage,
    });
  } else {
    result.push({
      round: state.round,
      actor: player.name,
      action: "attack",
      target: target.name,
      result: check.fumble ? "Fumble! Attack misses badly" : "Miss",
      damage: 0,
    });
  }
}

function resolvePlayerDefend(
  _state: CombatState,
  player: Player,
  extra: CombatExtra,
  result: CombatLogEntry[]
): void {
  extra.playerBuffs.push({ name: "defend", acBonus: 2, roundsRemaining: 1 });
  result.push({
    round: _state.round,
    actor: player.name,
    action: "defend",
    result: "Takes a defensive stance, gaining +2 AC until next turn",
  });
}

function resolvePlayerCast(
  state: CombatState,
  player: Player,
  extra: CombatExtra,
  abilityId: string | undefined,
  targetIndex: number,
  result: CombatLogEntry[]
): void {
  if (!abilityId) {
    result.push({
      round: state.round,
      actor: player.name,
      action: "cast",
      result: "No ability specified",
    });
    return;
  }

  const abilityDef = ABILITY_DEFS[abilityId];
  if (!abilityDef) {
    result.push({
      round: state.round,
      actor: player.name,
      action: "cast",
      result: `Unknown ability: ${abilityId}`,
    });
    return;
  }

  if (abilityId === "pick_lock") {
    result.push({
      round: state.round,
      actor: player.name,
      action: "cast",
      result: "Pick Lock is not a combat ability!",
    });
    return;
  }

  if (player.mp < abilityDef.mpCost) {
    result.push({
      round: state.round,
      actor: player.name,
      action: "cast",
      result: `Not enough MP for ${abilityId} (need ${abilityDef.mpCost}, have ${player.mp})`,
    });
    return;
  }

  player.mp -= abilityDef.mpCost;

  const resolution = abilityDef.resolve(player, state.monsters, targetIndex, extra);

  // For abilities that require a hit roll (power_attack)
  if (resolution.hitPenalty !== undefined && resolution.damage !== undefined && resolution.affectedIndexes.length > 0) {
    const target = state.monsters[resolution.affectedIndexes[0]!];
    if (target && target.hp > 0) {
      const strMod = statModifier(player.stats.str);
      const attackMod = strMod + getPlayerAttackBonus(extra) + resolution.hitPenalty;
      const monsterAC = target.ac + getMonsterACBonus(extra, resolution.affectedIndexes[0]!);
      const check = rollCheck(attackMod, monsterAC);
      if (!check.success) {
        result.push({
          round: state.round,
          actor: player.name,
          action: "cast",
          target: target.name,
          result: `${abilityId} missed!`,
          damage: 0,
        });
        return;
      }
    }
  }

  // Apply heal
  if (resolution.heal) {
    player.hp = Math.min(player.hpMax, player.hp + resolution.heal);
  }

  // Apply damage
  if (resolution.damage !== undefined && resolution.damage > 0) {
    for (const idx of resolution.affectedIndexes) {
      const target = state.monsters[idx];
      if (target && target.hp > 0) {
        target.hp = Math.max(0, target.hp - resolution.damage);
      }
    }
  }

  // Apply self-damage (e.g. Dark Pact)
  if (resolution.selfDamage) {
    player.hp = Math.max(1, player.hp - resolution.selfDamage);
  }

  // Apply MP restore (e.g. Dark Pact)
  if (resolution.mpRestore) {
    player.mp = Math.min(player.mpMax, player.mp + resolution.mpRestore);
  }

  // Apply buff
  if (resolution.buffAdded) {
    extra.playerBuffs.push({ ...resolution.buffAdded });
  }

  const targetName = resolution.affectedIndexes.length > 0
    ? state.monsters[resolution.affectedIndexes[0]!]?.name
    : undefined;

  result.push({
    round: state.round,
    actor: player.name,
    action: "cast",
    target: targetName,
    result: resolution.log,
    damage: resolution.damage,
  });
}

function resolvePlayerFlee(
  state: CombatState,
  player: Player,
  result: CombatLogEntry[]
): void {
  const dexMod = statModifier(player.stats.dex);
  const check = rollCheck(dexMod, 10);

  if (check.success) {
    // Signal flee by setting a special marker on the state
    // We'll use round = -1 as a sentinel for "fled"
    state.round = -1;
    result.push({
      round: state.round,
      actor: player.name,
      action: "flee",
      result: "Successfully fled from combat!",
    });
  } else {
    result.push({
      round: state.round,
      actor: player.name,
      action: "flee",
      result: "Failed to flee! Lost turn.",
    });
  }
}

function resolvePlayerUseItem(
  state: CombatState,
  player: Player,
  itemId: string | undefined,
  result: CombatLogEntry[]
): void {
  if (!itemId) {
    result.push({
      round: state.round,
      actor: player.name,
      action: "use_item",
      result: "No item specified",
    });
    return;
  }

  // Simple item resolution based on item type
  // In practice the tRPC layer would look up the real item; here we handle common patterns
  // Potions: heal HP or MP
  // Scrolls: one-time spell damage

  // Since we don't have inventory access in pure combat, we simulate via itemId pattern
  // The caller is expected to validate the item exists and pass appropriate data
  result.push({
    round: state.round,
    actor: player.name,
    action: "use_item",
    result: `Used item: ${itemId}`,
  });
}

// ---------------------------------------------------------------------------
// Monster turn resolution
// ---------------------------------------------------------------------------

function resolveMonsterTurn(
  state: CombatState,
  player: Player,
  extra: CombatExtra,
  monsterIndex: number,
  result: CombatLogEntry[]
): void {
  const monster = state.monsters[monsterIndex];
  if (!monster || monster.hp <= 0) return;

  // Tick monster buffs
  const currentBuffs = extra.monsterBuffs.get(monsterIndex) ?? [];
  extra.monsterBuffs.set(monsterIndex, tickBuffs(currentBuffs));

  // Monster AI: weighted random
  const roll100 = Math.random() * 100;
  const lowHp = monster.hp < monster.hpMax * 0.25;

  if (roll100 < 60) {
    // 60% attack
    resolveMonsterAttack(state, player, extra, monsterIndex, result);
  } else if (roll100 < 80) {
    // 20% special (or attack if no abilities)
    if (monster.abilities.length > 0) {
      resolveMonsterSpecial(state, player, extra, monsterIndex, result);
    } else {
      resolveMonsterAttack(state, player, extra, monsterIndex, result);
    }
  } else if (roll100 < 90) {
    // 10% defend
    resolveMonsterDefend(state, extra, monsterIndex, result);
  } else {
    // 10% flee (only if low HP)
    if (lowHp) {
      resolveMonsterFlee(state, monsterIndex, result);
    } else {
      resolveMonsterAttack(state, player, extra, monsterIndex, result);
    }
  }
}

function resolveMonsterAttack(
  state: CombatState,
  player: Player,
  extra: CombatExtra,
  monsterIndex: number,
  result: CombatLogEntry[]
): void {
  const monster = state.monsters[monsterIndex]!;

  // 30% chance to target companion if alive
  if (state.companion && state.companion.hp > 0 && Math.random() < 0.30) {
    resolveMonsterAttackCompanion(state, monster, result);
    return;
  }

  const playerAC = player.ac + getPlayerACBonus(extra);
  const check = rollCheck(monster.attack, playerAC);

  if (check.success) {
    let damage = rollDice(monster.damage);
    if (check.critical) {
      damage += rollDice(monster.damage);
    }
    damage = Math.max(1, damage);

    // Apply damage absorption
    const { remaining } = absorbDamage(extra, damage);
    player.hp = Math.max(0, player.hp - remaining);

    // Hitting the player increases aggro (blood in the water)
    extra.aggro = Math.min(10, extra.aggro + 1);

    // Clean up expired absorb buffs
    extra.playerBuffs = extra.playerBuffs.filter((b) => b.roundsRemaining > 0);

    result.push({
      round: state.round,
      actor: monster.name,
      action: "attack",
      target: player.name,
      result: check.critical
        ? `CRITICAL HIT! Deals ${damage} damage${remaining < damage ? ` (${damage - remaining} absorbed)` : ""}`
        : `Hits for ${damage} damage${remaining < damage ? ` (${damage - remaining} absorbed)` : ""}`,
      damage: remaining,
    });
  } else {
    result.push({
      round: state.round,
      actor: monster.name,
      action: "attack",
      target: player.name,
      result: "Misses",
      damage: 0,
    });
  }
}

function resolveMonsterAttackCompanion(
  state: CombatState,
  monster: Monster,
  result: CombatLogEntry[]
): void {
  const companion = state.companion!;
  const check = rollCheck(monster.attack, companion.ac);

  if (check.success) {
    let damage = rollDice(monster.damage);
    if (check.critical) damage += rollDice(monster.damage);
    damage = Math.max(1, damage);
    companion.hp = Math.max(0, companion.hp - damage);

    const defeatedMsg = companion.hp <= 0 ? ` ${companion.name} has fallen!` : "";
    result.push({
      round: state.round,
      actor: monster.name,
      action: "attack",
      target: companion.name,
      result: check.critical
        ? `CRITICAL HIT on ${companion.name}! Deals ${damage} damage.${defeatedMsg}`
        : `Hits ${companion.name} for ${damage} damage.${defeatedMsg}`,
      damage,
    });
  } else {
    result.push({
      round: state.round,
      actor: monster.name,
      action: "attack",
      target: companion.name,
      result: `Attacks ${companion.name} but misses`,
      damage: 0,
    });
  }
}

function resolveMonsterSpecial(
  state: CombatState,
  player: Player,
  extra: CombatExtra,
  monsterIndex: number,
  result: CombatLogEntry[]
): void {
  const monster = state.monsters[monsterIndex]!;
  const abilityName = monster.abilities[Math.floor(Math.random() * monster.abilities.length)]!;

  // Generic special attack: similar to normal attack but with flavor
  const playerAC = player.ac + getPlayerACBonus(extra);
  const check = rollCheck(monster.attack + 1, playerAC);

  if (check.success) {
    let damage = rollDice(monster.damage) + 2; // slightly more damage for special
    damage = Math.max(1, damage);

    const { remaining } = absorbDamage(extra, damage);
    player.hp = Math.max(0, player.hp - remaining);
    extra.playerBuffs = extra.playerBuffs.filter((b) => b.roundsRemaining > 0);

    result.push({
      round: state.round,
      actor: monster.name,
      action: abilityName,
      target: player.name,
      result: `Uses ${abilityName}! Deals ${damage} damage${remaining < damage ? ` (${damage - remaining} absorbed)` : ""}`,
      damage: remaining,
    });
  } else {
    result.push({
      round: state.round,
      actor: monster.name,
      action: abilityName,
      target: player.name,
      result: `Uses ${abilityName} but misses`,
      damage: 0,
    });
  }
}

function resolveMonsterDefend(
  state: CombatState,
  extra: CombatExtra,
  monsterIndex: number,
  result: CombatLogEntry[]
): void {
  const monster = state.monsters[monsterIndex]!;
  const buffs = extra.monsterBuffs.get(monsterIndex) ?? [];
  buffs.push({ name: "defend", acBonus: 2, roundsRemaining: 1 });
  extra.monsterBuffs.set(monsterIndex, buffs);

  result.push({
    round: state.round,
    actor: monster.name,
    action: "defend",
    result: "Takes a defensive stance, gaining +2 AC until next turn",
  });
}

function resolveMonsterFlee(
  state: CombatState,
  monsterIndex: number,
  result: CombatLogEntry[]
): void {
  const monster = state.monsters[monsterIndex]!;
  const dexApprox = Math.floor(monster.attack / 3);
  const check = rollCheck(dexApprox, 12);

  if (check.success) {
    monster.hp = 0; // removed from combat
    result.push({
      round: state.round,
      actor: monster.name,
      action: "flee",
      result: `${monster.name} flees from combat!`,
    });
  } else {
    result.push({
      round: state.round,
      actor: monster.name,
      action: "flee",
      result: `${monster.name} tries to flee but fails!`,
    });
  }
}

// ---------------------------------------------------------------------------
// Companion turn resolution
// ---------------------------------------------------------------------------

function resolveCompanionTurn(
  state: CombatState,
  _player: Player,
  _extra: CombatExtra,
  result: CombatLogEntry[]
): void {
  const companion = state.companion;
  if (!companion || companion.hp <= 0) return;

  // Simple AI: attack lowest HP alive monster
  let targetIndex = -1;
  let lowestHp = Infinity;
  for (let i = 0; i < state.monsters.length; i++) {
    if (state.monsters[i]!.hp > 0 && state.monsters[i]!.hp < lowestHp) {
      lowestHp = state.monsters[i]!.hp;
      targetIndex = i;
    }
  }

  if (targetIndex === -1) return;

  const target = state.monsters[targetIndex]!;
  const check = rollCheck(companion.attack, target.ac);

  if (check.success) {
    let damage = rollDice(companion.damage);
    if (check.critical) damage += rollDice(companion.damage);
    damage = Math.max(1, damage);
    target.hp = Math.max(0, target.hp - damage);

    result.push({
      round: state.round,
      actor: companion.name,
      action: "attack",
      target: target.name,
      result: check.critical
        ? `CRITICAL! Strikes for ${damage} damage${target.hp <= 0 ? " (defeated)" : ""}`
        : `Hits for ${damage} damage${target.hp <= 0 ? " (defeated)" : ""}`,
      damage,
    });
  } else {
    result.push({
      round: state.round,
      actor: companion.name,
      action: "attack",
      target: target.name,
      result: "Misses",
      damage: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Turn advancement
// ---------------------------------------------------------------------------

function advanceTurn(state: CombatState, extra: CombatExtra): void {
  // Don't advance if player fled (round === -1 is the flee sentinel)
  if (state.round === -1) return;

  let nextTurn = (state.currentTurn + 1) % state.turnOrder.length;

  // Skip dead monsters and dead companions
  let safety = 0;
  while (safety < state.turnOrder.length) {
    const entry = state.turnOrder[nextTurn]!;
    if (entry.type === "monster") {
      const monster = state.monsters[entry.index!];
      if (!monster || monster.hp <= 0) {
        nextTurn = (nextTurn + 1) % state.turnOrder.length;
        safety++;
        continue;
      }
    }
    if (entry.type === "companion") {
      if (!state.companion || state.companion.hp <= 0) {
        nextTurn = (nextTurn + 1) % state.turnOrder.length;
        safety++;
        continue;
      }
    }
    break;
  }

  // Detect new round
  if (nextTurn <= state.currentTurn) {
    state.round++;
    extra.roundNumber++;
  }

  state.currentTurn = nextTurn;
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export function calculateRewards(monsters: Monster[]): { xp: number; gold: number } {
  let xp = 0;
  let gold = 0;
  for (const monster of monsters) {
    xp += monster.xp;
    gold += roll(10) * monster.level;
  }
  return { xp, gold };
}
