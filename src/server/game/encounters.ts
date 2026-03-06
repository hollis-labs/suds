import type { MonsterEncounter, Monster } from "@/lib/types";
import type { Theme } from "@/lib/constants";
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
 * Pick a random element from an array.
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

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
 * Generate a monster encounter for the player.
 *
 * @param playerLevel - The player's current level
 * @param depth - How far from origin the room is (Manhattan distance)
 * @param theme - The dungeon theme
 * @returns A MonsterEncounter with 1-3 monsters
 */
export function generateEncounter(
  playerLevel: number,
  depth: number,
  theme: Theme
): MonsterEncounter {
  // Filter monsters by level range (playerLevel +/- 2) and theme match
  const eligible = MONSTERS.filter((m) => {
    const levelOk = m.level >= playerLevel - 2 && m.level <= playerLevel + 2;
    const themeOk = m.themes.includes(theme);
    return levelOk && themeOk;
  });

  // Fallback: if no theme match, allow all monsters in level range
  const pool =
    eligible.length > 0
      ? eligible
      : MONSTERS.filter(
          (m) => m.level >= playerLevel - 2 && m.level <= playerLevel + 2
        );

  // If still nothing (edge case), just pick from all monsters
  const finalPool = pool.length > 0 ? pool : MONSTERS;

  // Determine number of monsters: 1-3 based on depth
  // Deeper = more chance of multiple monsters
  let monsterCount: number;
  const multiRoll = Math.random();
  if (depth >= 8 && multiRoll < 0.3) {
    monsterCount = 3;
  } else if (depth >= 4 && multiRoll < 0.5) {
    monsterCount = 2;
  } else if (depth >= 2 && multiRoll < 0.3) {
    monsterCount = 2;
  } else {
    monsterCount = 1;
  }

  const monsters: Monster[] = [];
  for (let i = 0; i < monsterCount; i++) {
    const template = pickRandom(finalPool);
    const hp = scaleMonsterHp(template);

    monsters.push({
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
    });
  }

  return { monsters };
}
