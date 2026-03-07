import type { MonsterEncounter, Monster } from "@/lib/types";
import type { Theme } from "@/lib/constants";
import { GAME_CONFIG } from "@/lib/constants";
import { roll } from "@/server/game/dice";
import monstersData from "@/server/gamedata/monsters.json";

interface MonsterTemplate {
  id: string;
  name: string;
  level: number;
  hpBase: number;
  ac: number;
  attack: number;
  damage: string;
  xp: number;
  abilities: string[];
  themes: string[];
}

const MONSTERS: MonsterTemplate[] = monstersData as MonsterTemplate[];

/**
 * Generate a unique monster ID for this encounter instance.
 */
function generateMonsterId(): string {
  return `mon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Scale monster HP based on its base HP and level.
 * HP = hpBase + roll(1d8) per level (minimum hpBase).
 */
function scaleMonsterHp(template: MonsterTemplate): number {
  let hp = template.hpBase;
  for (let i = 1; i < template.level; i++) {
    hp += roll(8);
  }
  return hp;
}

/**
 * Weighted random selection: monsters closer to player level get higher weight.
 * Weight = max(1, 5 - |monsterLevel - playerLevel|)
 * So same-level = 5, ±1 = 4, ±2 = 3, ±3 = 2
 */
function weightedPick(pool: MonsterTemplate[], playerLevel: number): MonsterTemplate {
  const weights = pool.map((m) => Math.max(1, 5 - Math.abs(m.level - playerLevel)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * totalWeight;

  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/**
 * Build eligible monster pool filtered by level range and theme.
 */
function buildPool(playerLevel: number, theme: Theme): MonsterTemplate[] {
  const minLevel = Math.max(1, playerLevel + GAME_CONFIG.ENCOUNTER_LEVEL_MIN_OFFSET);
  const maxLevel = playerLevel + GAME_CONFIG.ENCOUNTER_LEVEL_MAX_OFFSET;

  // Primary: level range + theme match
  const themed = MONSTERS.filter((m) => {
    const levelOk = m.level >= minLevel && m.level <= maxLevel;
    const themeOk = m.themes.includes(theme);
    return levelOk && themeOk;
  });
  if (themed.length > 0) return themed;

  // Fallback: level range only (any theme)
  const levelOnly = MONSTERS.filter(
    (m) => m.level >= minLevel && m.level <= maxLevel
  );
  if (levelOnly.length > 0) return levelOnly;

  // Last resort: find closest monsters by level
  const sorted = [...MONSTERS].sort(
    (a, b) => Math.abs(a.level - playerLevel) - Math.abs(b.level - playerLevel)
  );
  return sorted.slice(0, 5);
}

/**
 * Determine encounter group using a difficulty budget.
 *
 * Budget = ENCOUNTER_DIFFICULTY_BUDGET (default 1.5).
 * Each monster costs (monsterLevel / playerLevel).
 * Keeps adding monsters until budget is spent, up to 3 max.
 */
function selectMonsters(
  pool: MonsterTemplate[],
  playerLevel: number
): MonsterTemplate[] {
  const budget = GAME_CONFIG.ENCOUNTER_DIFFICULTY_BUDGET;
  const selected: MonsterTemplate[] = [];
  let spent = 0;
  const maxMonsters = 3;

  // Always pick at least one
  const first = weightedPick(pool, playerLevel);
  selected.push(first);
  spent += first.level / Math.max(1, playerLevel);

  // Try adding more monsters within budget
  for (let i = 1; i < maxMonsters; i++) {
    const candidate = weightedPick(pool, playerLevel);
    const cost = candidate.level / Math.max(1, playerLevel);
    if (spent + cost > budget) break;
    selected.push(candidate);
    spent += cost;
  }

  return selected;
}

/**
 * Generate a monster encounter scaled to the player's level.
 *
 * Uses configurable level offsets, weighted random selection (favoring
 * monsters near player level), and a difficulty budget to control group size.
 */
export function generateEncounter(
  playerLevel: number,
  _depth: number,
  theme: Theme
): MonsterEncounter {
  const pool = buildPool(playerLevel, theme);
  const templates = selectMonsters(pool, playerLevel);

  const monsters: Monster[] = templates.map((template) => {
    const hp = scaleMonsterHp(template);
    return {
      id: generateMonsterId(),
      name: template.name,
      level: template.level,
      hp,
      hpMax: hp,
      ac: template.ac,
      attack: template.attack,
      damage: template.damage,
      xp: template.xp,
      abilities: [...template.abilities],
      description: `A level ${template.level} ${template.name}.`,
    };
  });

  return { monsters };
}
