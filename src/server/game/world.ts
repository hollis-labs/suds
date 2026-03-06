import { GAME_CONFIG, ROOM_TYPES } from "@/lib/constants";
import type { Theme, RoomType } from "@/lib/constants";
import type { Direction, Room } from "@/lib/types";
import { roll } from "@/server/game/dice";
import names from "@/server/gamedata/names.json";
import themes from "@/server/gamedata/themes.json";

// ---------------------------------------------------------------------------
// Starting Room (unchanged)
// ---------------------------------------------------------------------------

export interface StartingRoomData {
  characterId: string;
  x: number;
  y: number;
  name: string;
  type: "safe_room";
  description: string;
  exits: string[];
  depth: number;
  hasEncounter: false;
  encounterData: null;
  hasLoot: false;
  lootData: null;
  visited: true;
  roomFeatures: { campfire: true };
}

const STARTING_ROOMS: Record<Theme, { name: string; description: string }> = {
  horror: {
    name: "The Awakening Crypt",
    description:
      "You awaken on a cold stone slab, the air thick with the scent of decay. Flickering torches line crumbling walls. A campfire crackles in the center, its warmth a fragile barrier against the darkness that presses in from every shadow. This place feels wrong, but at least here you are safe... for now.",
  },
  funny: {
    name: "The Oops-I-Did-It-Again Room",
    description:
      "You materialize in a cozy room decorated with motivational posters featuring dragons. A campfire burns cheerfully in a fireplace shaped like a smiling goblin. A sign reads: 'Welcome, Adventurer! Please don't die on the first floor. Again.' Someone left cookies by the fire.",
  },
  epic: {
    name: "The Hall of First Light",
    description:
      "You stand in a grand chamber carved from living crystal. Ancient runes pulse with golden light along the walls, telling tales of heroes who came before. A sacred campfire burns with an eternal flame at the hall's center, blessed by the old gods. Your legend begins here.",
  },
  dark_fantasy: {
    name: "The Forsaken Threshold",
    description:
      "A dim chamber greets you, its walls stained with the passage of ages. Chains hang from the ceiling, their purpose long forgotten. A campfire gutters in the draft, casting long shadows that seem to move of their own accord. The world beyond this room has been corrupted, but this place still holds.",
  },
};

/**
 * Generate the starting room for a new character.
 */
export function generateStartingRoom(
  characterId: string,
  theme: Theme
): StartingRoomData {
  const roomDef = STARTING_ROOMS[theme];

  return {
    characterId,
    x: 0,
    y: 0,
    name: roomDef.name,
    type: "safe_room",
    description: roomDef.description,
    exits: ["north", "east", "south"],
    depth: 0,
    hasEncounter: false,
    encounterData: null,
    hasLoot: false,
    lootData: null,
    visited: true,
    roomFeatures: { campfire: true },
  };
}

// ---------------------------------------------------------------------------
// Full Room Generation
// ---------------------------------------------------------------------------

const ALL_DIRECTIONS: Direction[] = ["north", "south", "east", "west"];

const SAFE_ROOM_TYPES: RoomType[] = [
  "safe_room",
  "store",
  "shrine",
  "npc_room",
];

const TRAP_TYPES = ["dart", "pit", "poison"] as const;

/**
 * Return the opposite compass direction.
 */
export function oppositeDirection(dir: Direction): Direction {
  const map: Record<Direction, Direction> = {
    north: "south",
    south: "north",
    east: "west",
    west: "east",
  };
  return map[dir];
}

/**
 * Pick a room type using weighted random based on depth.
 * Boss rooms only appear at depth >= 8.
 */
export function pickRoomType(depth: number): RoomType {
  const entries = Object.entries(ROOM_TYPES) as [
    RoomType,
    (typeof ROOM_TYPES)[RoomType],
  ][];

  // Calculate interpolation factor: 0 at depth 0, 1 at depth >= 10
  const t = Math.min(1, Math.max(0, (depth - 0) / 10));

  const weights: { type: RoomType; weight: number }[] = [];

  for (const [type, def] of entries) {
    // Boss rooms only at depth >= 8
    if (type === "boss_room" && depth < 8) continue;

    const weight = def.shallowWeight + t * (def.deepWeight - def.shallowWeight);
    if (weight > 0) {
      weights.push({ type, weight });
    }
  }

  // Weighted random selection
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let rand = Math.random() * totalWeight;

  for (const w of weights) {
    rand -= w.weight;
    if (rand <= 0) return w.type;
  }

  // Fallback (should not happen)
  return "corridor";
}

/**
 * Generate a random room name from adjective + noun in names.json.
 */
export function generateRoomName(_theme: Theme): string {
  const adjIdx = roll(names.roomAdjectives.length) - 1;
  const nounIdx = roll(names.roomNouns.length) - 1;
  return `${names.roomAdjectives[adjIdx]} ${names.roomNouns[nounIdx]}`;
}

/**
 * Generate a room description based on theme and room type.
 */
export function generateRoomDescription(theme: Theme, _roomType: RoomType): string {
  const themeData = themes[theme];
  const descs = themeData.roomDescriptions;
  const idx = roll(descs.length) - 1;
  return descs[idx]!;
}

/**
 * Generate exits for a room.
 * Always includes the reverse of entryDirection.
 * Other directions have 50% chance each.
 */
export function generateExits(entryDirection: Direction | null): Direction[] {
  const exits: Set<Direction> = new Set();

  // Always include the way back
  if (entryDirection !== null) {
    exits.add(oppositeDirection(entryDirection));
  }

  // For other directions, 50% chance each
  for (const dir of ALL_DIRECTIONS) {
    if (entryDirection !== null && dir === oppositeDirection(entryDirection)) {
      continue; // Already added
    }
    if (Math.random() < 0.5) {
      exits.add(dir);
    }
  }

  // If we have entry but no other exits at all, that's fine — entry direction is guaranteed
  // If no entry direction and no exits generated, force at least one
  if (exits.size === 0) {
    const idx = roll(ALL_DIRECTIONS.length) - 1;
    exits.add(ALL_DIRECTIONS[idx]!);
  }

  return Array.from(exits);
}

/**
 * Generate room features based on room type and depth.
 */
function generateRoomFeatures(
  roomType: RoomType,
  depth: number,
  hasLoot: boolean
): Record<string, unknown> {
  switch (roomType) {
    case "safe_room":
      return { campfire: true };
    case "shrine":
      return { altar: true, blessing_available: true };
    case "trap_room": {
      const trapIdx = roll(TRAP_TYPES.length) - 1;
      return {
        trap: {
          type: TRAP_TYPES[trapIdx],
          dc: 10 + Math.floor(depth / 2),
          damage: `1d6+${depth}`,
        },
      };
    }
    case "chamber":
      return hasLoot ? { chest: true } : {};
    default:
      return {};
  }
}

/**
 * Generate a full room at the given coordinates.
 * Does NOT save to DB — caller does that.
 */
export function generateRoom(
  characterId: string,
  x: number,
  y: number,
  theme: Theme,
  depth: number,
  entryDirection: Direction | null
): Room {
  const calculatedDepth = Math.abs(x) + Math.abs(y);
  // Use provided depth or calculated depth (prefer calculated for consistency)
  const effectiveDepth = depth > 0 ? depth : calculatedDepth;

  const roomType = pickRoomType(effectiveDepth);
  const roomName = generateRoomName(theme);
  const description = generateRoomDescription(theme, roomType);
  const exits = generateExits(entryDirection);

  // Encounter check — skip for safe room types
  let hasEncounter = false;
  if (!SAFE_ROOM_TYPES.includes(roomType)) {
    const encounterChance =
      GAME_CONFIG.ENCOUNTER_BASE_CHANCE +
      effectiveDepth * GAME_CONFIG.ENCOUNTER_DEPTH_MODIFIER;
    hasEncounter = Math.random() < encounterChance;
  }

  // Loot check
  let hasLoot = false;
  if (roomType === "boss_room") {
    hasLoot = Math.random() < 0.6;
  } else if (roomType === "chamber") {
    hasLoot = Math.random() < 0.3;
  } else if (roomType === "corridor") {
    hasLoot = Math.random() < 0.05;
  } else if (
    roomType !== "safe_room" &&
    roomType !== "store" &&
    roomType !== "shrine" &&
    roomType !== "npc_room"
  ) {
    hasLoot = Math.random() < 0.1;
  }

  const roomFeatures = generateRoomFeatures(roomType, effectiveDepth, hasLoot);

  return {
    id: `room-${characterId}-${x}-${y}`,
    x,
    y,
    name: roomName,
    type: roomType,
    description,
    exits,
    depth: effectiveDepth,
    hasEncounter,
    encounterData: null, // Caller populates if needed
    hasLoot,
    lootData: null, // Caller populates if needed
    visited: false,
    roomFeatures,
  };
}
