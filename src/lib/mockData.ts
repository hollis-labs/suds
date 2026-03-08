import type { Player, Room, MapViewport, MapCell } from "@/lib/types";

export const mockPlayer: Player = {
  id: "player-001",
  name: "Thorn Ironforge",
  class: "fighter",
  theme: "dark_fantasy",
  level: 3,
  xp: 840,
  xpNext: 1200,
  hp: 45,
  hpMax: 52,
  mp: 10,
  mpMax: 30,
  gold: 127,
  stats: { str: 18, dex: 12, con: 16, int: 8, wis: 10, cha: 10 },
  ac: 17,
  position: { x: 3, y: 2 },
  equipment: {
    weapon: {
      id: "w1",
      itemId: "longsword-01",
      name: "Flame-Touched Longsword",
      type: "weapon",
      rarity: "uncommon",
      stats: { attack: 4, fireDamage: 2 },
      quantity: 1,
      slot: 0,
      isEquipped: true,
      description: "A blade that glows faintly with inner fire.",
    },
    armor: {
      id: "a1",
      itemId: "chainmail-01",
      name: "Dwarven Chainmail",
      type: "armor",
      rarity: "uncommon",
      stats: { ac: 5, con: 1 },
      quantity: 1,
      slot: 1,
      isEquipped: true,
      description: "Finely crafted chainmail of dwarven origin.",
    },
  },
  abilities: ["power_attack", "shield_block"],
  lastSafe: { x: 0, y: 0 },
  baseLevel: 1,
};

export const mockRoom: Room = {
  id: "room-3-2",
  x: 3,
  y: 2,
  name: "The Whispering Chamber",
  type: "chamber",
  description:
    "A vast chamber stretches before you, its vaulted ceiling lost in shadow. Strange whispers echo from the walls, words just beyond understanding. Faded murals depict a forgotten battle between mortals and beings of pure darkness. A cold draft carries the scent of old stone and something faintly metallic.",
  exits: ["north", "east", "south"],
  depth: 4,
  hasEncounter: false,
  encounterData: null,
  hasLoot: true,
  lootData: [
    {
      id: "loot-1",
      itemId: "potion-healing-01",
      name: "Potion of Healing",
      type: "potion",
      rarity: "common",
      stats: { healing: 15 },
      quantity: 1,
      slot: null,
      isEquipped: false,
      description: "A ruby-red liquid that mends wounds.",
    },
  ],
  visited: true,
  roomFeatures: { ambience: "whispers", lighting: "dim" },
};

function makeCell(
  x: number,
  y: number,
  room: Partial<Room> | null,
  isVisible: boolean,
  isCurrent: boolean,
  hasPlayer: boolean,
  connections: MapCell["connections"]
): MapCell {
  return {
    x,
    y,
    room: room
      ? ({
          id: `room-${x}-${y}`,
          x,
          y,
          name: room.name ?? "Room",
          type: room.type ?? "corridor",
          description: "",
          exits: room.exits ?? [],
          depth: room.depth ?? 1,
          hasEncounter: false,
          encounterData: null,
          hasLoot: false,
          lootData: null,
          visited: room.visited ?? true,
          roomFeatures: {},
        } as Room)
      : null,
    isVisible,
    isCurrent,
    hasPlayer,
    connections,
  };
}

function emptyCell(x: number, y: number): MapCell {
  return {
    x,
    y,
    room: null,
    isVisible: false,
    isCurrent: false,
    hasPlayer: false,
    connections: { north: false, south: false, east: false, west: false },
  };
}

// Build a 15x11 grid with ~10 explored rooms
function buildMockMap(): MapViewport {
  const width = 15;
  const height = 11;
  const cells: MapCell[][] = [];

  for (let row = 0; row < height; row++) {
    const rowCells: MapCell[] = [];
    for (let col = 0; col < width; col++) {
      rowCells.push(emptyCell(col, row));
    }
    cells.push(rowCells);
  }

  // Place rooms (col, row) — note cells[row][col]
  // Starting safe room
  cells[3][5] = makeCell(5, 3, { name: "Entrance Hall", type: "safe_room", exits: ["east"], visited: true }, true, false, false, { north: false, south: false, east: true, west: false });

  // Corridor east of entrance
  cells[3][6] = makeCell(6, 3, { name: "Dusty Corridor", type: "corridor", exits: ["west", "east", "south"], visited: true }, true, false, false, { north: false, south: true, east: true, west: true });

  // Store
  cells[3][7] = makeCell(7, 3, { name: "Grimwick's Goods", type: "store", exits: ["west", "north"], visited: true }, true, false, false, { north: true, south: false, east: false, west: true });

  // NPC room north of store
  cells[2][7] = makeCell(7, 2, { name: "Hermit's Alcove", type: "npc_room", exits: ["south"], visited: true }, true, false, false, { north: false, south: true, east: false, west: false });

  // Corridor south
  cells[4][6] = makeCell(6, 4, { name: "Narrow Passage", type: "corridor", exits: ["north", "east"], visited: true }, true, false, false, { north: true, south: false, east: true, west: false });

  // Chamber — player is here
  cells[4][7] = makeCell(7, 4, { name: "The Whispering Chamber", type: "chamber", exits: ["west", "south", "east"], visited: true }, true, true, true, { north: false, south: true, east: true, west: true });

  // Trap room east
  cells[4][8] = makeCell(8, 4, { name: "Rigged Hallway", type: "trap_room", exits: ["west"], visited: true }, true, false, false, { north: false, south: false, east: false, west: true });

  // Boss room south
  cells[5][7] = makeCell(7, 5, { name: "Throne of Shadows", type: "boss_room", exits: ["north", "east"], visited: true }, true, false, false, { north: true, south: false, east: true, west: false });

  // Shrine east of boss
  cells[5][8] = makeCell(8, 5, { name: "Forgotten Shrine", type: "shrine", exits: ["west"], visited: true }, true, false, false, { north: false, south: false, east: false, west: true });

  // Fog-of-war visible but unexplored cells near explored rooms
  cells[3][4] = makeCell(4, 3, null, true, false, false, { north: false, south: false, east: false, west: false });
  cells[1][7] = makeCell(7, 1, null, true, false, false, { north: false, south: false, east: false, west: false });
  cells[4][9] = makeCell(9, 4, null, true, false, false, { north: false, south: false, east: false, west: false });

  return {
    cells,
    offsetX: 0,
    offsetY: 0,
    width,
    height,
  };
}

export const mockMapViewport: MapViewport = buildMockMap();

export const mockGameLog: string[] = [
  "You enter the dungeon through the ancient stone gateway.",
  "The air grows cold as you descend deeper.",
  "You found a Potion of Healing in a dusty alcove.",
  "A rat scurries past your feet and vanishes into a crack.",
  "You defeated a Shadow Imp! (+45 XP)",
  "You enter The Whispering Chamber.",
  "Strange whispers echo from the walls...",
  "You notice a glint of something on the floor.",
];
