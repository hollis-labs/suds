/** Roll a single die with the given number of sides. */
export function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** Roll multiple dice, returning an array of individual results. */
export function rollMultiple(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => roll(sides));
}

/**
 * Parse and roll dice notation like "2d6+3", "1d8", "3d4-1".
 * Supports: NdS, NdS+M, NdS-M. Result is floored at 0.
 */
export function rollDice(notation: string): number {
  const match = notation.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) throw new Error(`Invalid dice notation: "${notation}"`);

  const count = parseInt(match[1]!, 10);
  const sides = parseInt(match[2]!, 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  const rolls = rollMultiple(count, sides);
  const total = rolls.reduce((sum, r) => sum + r, 0) + modifier;

  return Math.max(0, total);
}

/** Roll a d20. */
export function rollD20(): number {
  return roll(20);
}

/** Roll initiative: d20 + dexterity modifier. */
export function rollInitiative(dexMod: number): number {
  return rollD20() + dexMod;
}

/**
 * Roll an ability check or attack roll against a difficulty class.
 * Returns the raw roll, total (roll + modifier), and whether it succeeded.
 * Natural 20 is always a critical success; natural 1 is always a fumble/failure.
 */
export function rollCheck(
  modifier: number,
  dc: number
): {
  roll: number;
  total: number;
  success: boolean;
  critical: boolean;
  fumble: boolean;
} {
  const rawRoll = rollD20();
  const total = rawRoll + modifier;
  const critical = rawRoll === 20;
  const fumble = rawRoll === 1;

  return {
    roll: rawRoll,
    total,
    success: critical || (!fumble && total >= dc),
    critical,
    fumble,
  };
}
