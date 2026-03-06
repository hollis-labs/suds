import type { Theme } from "@/lib/constants";

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
