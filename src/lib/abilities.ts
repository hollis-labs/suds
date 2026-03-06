export const ABILITY_INFO: Record<
  string,
  {
    name: string;
    description: string;
    mpCost: number;
    type: "attack" | "defense" | "heal" | "buff" | "utility";
  }
> = {
  power_attack: {
    name: "Power Attack",
    description: "A devastating blow. +4 damage, -2 to hit.",
    mpCost: 0,
    type: "attack",
  },
  shield_block: {
    name: "Shield Block",
    description: "Raise your shield. +4 AC until next turn.",
    mpCost: 0,
    type: "defense",
  },
  cleave: {
    name: "Cleave",
    description: "Swing at two enemies at once.",
    mpCost: 5,
    type: "attack",
  },
  battle_cry: {
    name: "Battle Cry",
    description: "+2 attack, +1 damage for 3 rounds.",
    mpCost: 0,
    type: "buff",
  },
  arcane_missile: {
    name: "Arcane Missile",
    description: "A bolt of pure magic. Auto-hit.",
    mpCost: 5,
    type: "attack",
  },
  fireball: {
    name: "Fireball",
    description: "Explosion of fire. Hits all enemies.",
    mpCost: 10,
    type: "attack",
  },
  ice_shield: {
    name: "Ice Shield",
    description: "+3 AC for 3 rounds.",
    mpCost: 8,
    type: "defense",
  },
  chain_lightning: {
    name: "Chain Lightning",
    description: "Lightning arcs to up to 3 targets.",
    mpCost: 15,
    type: "attack",
  },
  sneak_attack: {
    name: "Sneak Attack",
    description: "Strike from the shadows. Extra damage first round.",
    mpCost: 0,
    type: "attack",
  },
  pick_lock: {
    name: "Pick Lock",
    description: "Open locked chests and doors.",
    mpCost: 0,
    type: "utility",
  },
  dodge: {
    name: "Dodge",
    description: "+4 AC and advantage on DEX saves.",
    mpCost: 0,
    type: "defense",
  },
  assassinate: {
    name: "Assassinate",
    description: "Lethal strike. Only on first round.",
    mpCost: 10,
    type: "attack",
  },
  heal: {
    name: "Heal",
    description: "Restore HP with divine energy.",
    mpCost: 8,
    type: "heal",
  },
  smite: {
    name: "Smite",
    description: "Holy strike. Extra damage vs undead.",
    mpCost: 5,
    type: "attack",
  },
  bless: {
    name: "Bless",
    description: "+2 to all attack rolls for 3 rounds.",
    mpCost: 10,
    type: "buff",
  },
  divine_shield: {
    name: "Divine Shield",
    description: "Absorb next 20 damage.",
    mpCost: 12,
    type: "defense",
  },
};
