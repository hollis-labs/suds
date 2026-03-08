// ─── Building Generator ──────────────────────────────────────────────────────
//
// AI-powered building generation for the world hierarchy.
// Generates building data + floor layout templates for each building type.
// For dungeons, reuses the existing generateRoom() with hierarchy fields.
// Returns data ready for insertion — does NOT commit to DB.

import type { Theme, RoomType } from "@/lib/constants";
import type { NewBuilding } from "@/server/db/schema";
import { selectOrGenerate } from "@/server/game/content-library";
import { isAIEnabled } from "@/server/game/ai";
import { sanitizeAIContent } from "@/server/game/safety";
import { generateRoom } from "@/server/game/world";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { aiUsage } from "@/server/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BuildingType = "tavern" | "shop" | "temple" | "house" | "castle" | "dungeon";

export interface FloorRoom {
  x: number;
  y: number;
  roomType: RoomType;
  name?: string;
  features?: Record<string, unknown>;
}

export interface FloorLayout {
  floor: number;
  width: number;
  height: number;
  rooms: FloorRoom[];
}

export interface BuildingGenResult {
  name: string;
  description: string;
  floors: FloorLayout[];
}

export interface GenerateBuildingOptions {
  nameHint?: string;
  floorCountOverride?: number;
}

export interface GenerateBuildingResult {
  building: Omit<NewBuilding, "id">;
  floorLayouts: FloorLayout[];
}

// ─── Building Type Config ───────────────────────────────────────────────────

interface BuildingConfig {
  floorRange: [number, number];
  gridWidth: number;
  gridHeight: number;
  roomTypes: RoomType[];
  roomCount: [number, number]; // per floor
}

const BUILDING_CONFIG: Record<BuildingType, BuildingConfig> = {
  tavern: {
    floorRange: [1, 1],
    gridWidth: 8,
    gridHeight: 8,
    roomTypes: ["safe_room", "npc_room", "store"],
    roomCount: [3, 5],
  },
  shop: {
    floorRange: [1, 1],
    gridWidth: 6,
    gridHeight: 6,
    roomTypes: ["store", "corridor"],
    roomCount: [2, 3],
  },
  temple: {
    floorRange: [1, 2],
    gridWidth: 8,
    gridHeight: 8,
    roomTypes: ["shrine", "safe_room", "corridor"],
    roomCount: [3, 5],
  },
  house: {
    floorRange: [1, 1],
    gridWidth: 5,
    gridHeight: 5,
    roomTypes: ["corridor", "npc_room", "chamber"],
    roomCount: [2, 3],
  },
  castle: {
    floorRange: [2, 3],
    gridWidth: 12,
    gridHeight: 12,
    roomTypes: ["corridor", "chamber", "npc_room", "store", "shrine", "safe_room"],
    roomCount: [5, 8],
  },
  dungeon: {
    floorRange: [3, 10],
    gridWidth: 15,
    gridHeight: 15,
    roomTypes: ["corridor", "chamber", "trap_room", "boss_room", "shrine", "safe_room"],
    roomCount: [6, 12],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ─── Fallback Names ─────────────────────────────────────────────────────────

const BUILDING_NAMES: Record<BuildingType, Record<Theme, string[]>> = {
  tavern: {
    horror: ["The Pallid Tankard", "The Eyeless Owl", "The Drowned Rat", "The Bone Cup"],
    funny: ["The Wobbly Stool", "Drinks & Bad Decisions", "The Hiccup & Burp", "Ye Olde Nap Spot"],
    epic: ["The Golden Flagon", "The Hero's Respite", "The Shining Chalice", "Valor's Draught"],
    dark_fantasy: ["The Ashen Mug", "The Last Warm Fire", "The Bitter Drop", "The Hollow Cup"],
  },
  shop: {
    horror: ["Curiosities & Remains", "The Pickled Finger", "Relics of the Damned"],
    funny: ["Loot 'n' Scoot", "Questionable Quality Goods", "The Impulse Buy Emporium"],
    epic: ["The Armory of Ages", "Legendary Outfitters", "The Crystal Market"],
    dark_fantasy: ["The Pawnbroker's Burden", "Ash & Iron Trading", "The Bleak Bazaar"],
  },
  temple: {
    horror: ["The Bleeding Altar", "Chapel of Silence", "The Ossuary Shrine"],
    funny: ["Church of Adequate Blessings", "The 'Please Don't Smite Me' Temple"],
    epic: ["The Radiant Sanctum", "Temple of Eternal Dawn", "The God-Touched Spire"],
    dark_fantasy: ["The Ashen Shrine", "Temple of Forgotten Gods", "The Hollow Sanctum"],
  },
  house: {
    horror: ["A Decaying Hovel", "The Watching House", "A Shuttered Dwelling"],
    funny: ["Bob's Surprisingly Nice House", "A Suspiciously Clean Cottage"],
    epic: ["A Noble's Manor", "The Elder's Residence", "A Scholar's Study"],
    dark_fantasy: ["A Crumbling Homestead", "The Survivor's Shelter", "A Shuttered Dwelling"],
  },
  castle: {
    horror: ["Castle Dreadmire", "The Wailing Keep", "Fortress of Bone"],
    funny: ["Castle Blanket Fort", "The Slightly Intimidating Palace"],
    epic: ["The Sunforged Citadel", "Castle Valorheim", "The Dragon King's Seat"],
    dark_fantasy: ["The Iron Throne Hall", "Ashfall Keep", "The Hollow Crown Castle"],
  },
  dungeon: {
    horror: ["The Screaming Depths", "Crypt of the Unborn", "The Gnawing Dark"],
    funny: ["The Moderately Scary Basement", "Dungeon Classic™", "The Complaint Department"],
    epic: ["The Trials Below", "Abyssal Proving Grounds", "The Mythic Undercrypt"],
    dark_fantasy: ["The Hollow Below", "Depths of the Forsaken", "The Ashen Descent"],
  },
};

// ─── Floor Layout Generator (Procedural) ────────────────────────────────────

function generateFloorLayout(
  buildingType: BuildingType,
  floor: number,
  totalFloors: number,
  theme: Theme,
  characterId?: string,
): FloorLayout {
  const config = BUILDING_CONFIG[buildingType];
  const roomCount = randInt(config.roomCount[0], config.roomCount[1]);
  const rooms: FloorRoom[] = [];
  const used = new Set<string>();

  for (let i = 0; i < roomCount; i++) {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = randInt(0, config.gridWidth - 1);
      y = randInt(0, config.gridHeight - 1);
      attempts++;
    } while (used.has(`${x},${y}`) && attempts < 30);
    if (attempts >= 30) continue;
    used.add(`${x},${y}`);

    let roomType: RoomType;

    // Special room placement logic
    if (i === 0 && floor === 0) {
      // First room on first floor is always safe/entrance
      roomType = buildingType === "tavern" ? "safe_room" : "corridor";
    } else if (buildingType === "dungeon" && floor === totalFloors - 1 && i === roomCount - 1) {
      // Last room on last dungeon floor is boss
      roomType = "boss_room";
    } else if (buildingType === "tavern" && i === 1) {
      // Second room in tavern is the store/bar
      roomType = "store";
    } else {
      roomType = pick(config.roomTypes);
    }

    // For dungeons, use the existing room generator for richer data
    if (buildingType === "dungeon" && characterId) {
      const depth = floor * 3 + i;
      const room = generateRoom(characterId, x, y, theme, depth, null);
      rooms.push({
        x,
        y,
        roomType: room.type as RoomType,
        name: room.name,
        features: room.roomFeatures as Record<string, unknown>,
      });
    } else {
      rooms.push({ x, y, roomType });
    }
  }

  return {
    floor,
    width: config.gridWidth,
    height: config.gridHeight,
    rooms,
  };
}

function generateBuildingFallback(buildingType: BuildingType, theme: Theme): BuildingGenResult {
  const config = BUILDING_CONFIG[buildingType];
  const floorCount = randInt(config.floorRange[0], config.floorRange[1]);
  const name = pick(BUILDING_NAMES[buildingType][theme]);

  const floors: FloorLayout[] = [];
  for (let f = 0; f < floorCount; f++) {
    floors.push(generateFloorLayout(buildingType, f, floorCount, theme));
  }

  return {
    name,
    description: `A ${buildingType} standing against the ${theme} backdrop. Its walls tell stories of ages past.`,
    floors,
  };
}

// ─── AI Generator ───────────────────────────────────────────────────────────

const MODEL = "claude-haiku-4-5-20251001";

const THEME_PROMPTS: Record<Theme, string> = {
  horror: "You write for a horror-themed fantasy world. Tone: creepy, unsettling, atmospheric dread.",
  funny: "You write for a comedy-themed fantasy world. Tone: absurd, punny, lighthearted.",
  epic: "You write for an epic/heroic fantasy world. Tone: grand, mythological, sweeping.",
  dark_fantasy: "You write for a dark fantasy world. Tone: bleak, morally gray, tragic beauty.",
};

async function generateBuildingAI(buildingType: BuildingType, theme: Theme): Promise<BuildingGenResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const config = BUILDING_CONFIG[buildingType];
  const floorCount = randInt(config.floorRange[0], config.floorRange[1]);

  const prompt =
    `Generate a ${buildingType} building for a ${theme} fantasy world.\n` +
    `Floors: ${floorCount}, grid per floor: ${config.gridWidth}x${config.gridHeight}\n\n` +
    `Return ONLY valid JSON (no markdown, no code fences):\n` +
    `{\n` +
    `  "name": "<evocative building name>",\n` +
    `  "description": "<2-3 sentences describing the building's exterior and atmosphere>"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Name should be 2-5 words, memorable and thematic\n` +
    `- Description should hint at what's inside\n` +
    `- Match the ${theme} tone precisely`;

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.9,
    system: THEME_PROMPTS[theme],
    messages: [{ role: "user", content: prompt }],
  });
  const durationMs = Date.now() - start;

  db.insert(aiUsage)
    .values({
      model: MODEL,
      feature: "building_generation",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
    })
    .catch(() => {});

  const block = response.content[0];
  if (!block || block.type !== "text") throw new Error("No text response from AI for building generation");

  const parsed = JSON.parse(block.text.trim()) as { name: string; description: string };
  if (!parsed.name || !parsed.description) {
    throw new Error("Missing required fields in AI building response");
  }

  // Generate floor layouts procedurally (AI handles name/desc, layout is algorithmic)
  const floors: FloorLayout[] = [];
  for (let f = 0; f < floorCount; f++) {
    floors.push(generateFloorLayout(buildingType, f, floorCount, theme));
  }

  return {
    name: sanitizeAIContent(parsed.name),
    description: sanitizeAIContent(parsed.description),
    floors,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a building for the given area. Uses content library cache first,
 * falls back to AI, then to procedural fallback.
 *
 * Returns building data + floor layouts for the caller to insert.
 */
export async function generateBuilding(
  areaId: string,
  buildingType: BuildingType,
  position: { x: number; y: number },
  theme: Theme,
  options?: GenerateBuildingOptions,
): Promise<GenerateBuildingResult> {
  const config = BUILDING_CONFIG[buildingType];
  const floorCount = options?.floorCountOverride ?? randInt(config.floorRange[0], config.floorRange[1]);

  const result = (await selectOrGenerate(db, {
    type: "building" as never,
    theme,
    tags: ["world-gen", `building:${buildingType}`],
    generate: async () => {
      if (isAIEnabled()) {
        return await generateBuildingAI(buildingType, theme);
      }
      return generateBuildingFallback(buildingType, theme);
    },
  })) as BuildingGenResult;

  // Re-generate floor layouts if cached result doesn't have them or floor count differs
  let floorLayouts = result.floors;
  if (!floorLayouts || floorLayouts.length !== floorCount) {
    floorLayouts = [];
    for (let f = 0; f < floorCount; f++) {
      floorLayouts.push(generateFloorLayout(buildingType, f, floorCount, theme));
    }
  }

  return {
    building: {
      areaId,
      name: options?.nameHint ?? result.name,
      description: result.description,
      buildingType,
      floors: floorCount,
      gridWidth: config.gridWidth,
      gridHeight: config.gridHeight,
      position,
      metadata: {
        floorLayouts: floorLayouts.map((fl) => ({
          floor: fl.floor,
          roomCount: fl.rooms.length,
        })),
      },
      generatedBy: isAIEnabled() ? "ai" : "template",
    },
    floorLayouts,
  };
}
