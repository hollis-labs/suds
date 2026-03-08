// ─── Area Generator ──────────────────────────────────────────────────────────
//
// AI-powered area generation for the world hierarchy.
// Each area type (town, wilderness, ruins, fortress, dungeon_entrance)
// has different generation strategies for grid size, buildings, and features.
// Returns data ready for insertion — does NOT commit to DB.

import type { Theme } from "@/lib/constants";
import type { NewArea } from "@/server/db/schema";
import { selectOrGenerate } from "@/server/game/content-library";
import { isAIEnabled } from "@/server/game/ai";
import { sanitizeAIContent } from "@/server/game/safety";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { aiUsage } from "@/server/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AreaType = "town" | "wilderness" | "ruins" | "fortress" | "dungeon_entrance";

export interface BuildingPosition {
  x: number;
  y: number;
  buildingType: string;
  suggestedName: string;
}

export interface AreaGenResult {
  name: string;
  description: string;
  buildings: BuildingPosition[];
  features: string[];
}

export interface GenerateAreaResult {
  area: Omit<NewArea, "id">;
  buildings: BuildingPosition[];
}

// ─── Area Type Config ───────────────────────────────────────────────────────

const AREA_CONFIG: Record<AreaType, { gridWidth: number; gridHeight: number; buildingCount: [number, number] }> = {
  town: { gridWidth: 15, gridHeight: 15, buildingCount: [3, 5] },
  wilderness: { gridWidth: 20, gridHeight: 20, buildingCount: [1, 2] },
  ruins: { gridWidth: 15, gridHeight: 15, buildingCount: [2, 3] },
  fortress: { gridWidth: 15, gridHeight: 15, buildingCount: [3, 5] },
  dungeon_entrance: { gridWidth: 10, gridHeight: 10, buildingCount: [1, 1] },
};

const BUILDING_TYPES_BY_AREA: Record<AreaType, string[]> = {
  town: ["tavern", "shop", "temple", "house", "house"],
  wilderness: ["ruins", "dungeon"],
  ruins: ["dungeon", "temple", "house"],
  fortress: ["castle", "shop", "temple", "house", "dungeon"],
  dungeon_entrance: ["dungeon"],
};

// ─── Fallback Generator ─────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const AREA_NAMES: Record<AreaType, Record<Theme, string[]>> = {
  town: {
    horror: ["Gravemire Village", "Hollowpoint", "Rottingham", "Blightwell", "Deadhaven"],
    funny: ["Bumbleburg", "Noodleton", "Sir Snooze-a-Lot's Landing", "Oopsdale", "Flickville"],
    epic: ["Sunhaven", "Goldenreach", "Starfall Village", "Valor's Rest", "Brightkeep Town"],
    dark_fantasy: ["Ashford Settlement", "Duskwall", "Cinderhollow", "The Gray Hamlet", "Thornbury"],
  },
  wilderness: {
    horror: ["The Withered Reach", "Moaning Thicket", "Carrion Fields", "The Pale Marsh", "Deathbloom Clearing"],
    funny: ["The Slightly Dangerous Woods", "Naptime Meadow", "Bumbling Brook Area", "The Scenic Detour"],
    epic: ["The Verdant Expanse", "Dragonscale Ridge", "The Singing Wilds", "Stormwind Valley"],
    dark_fantasy: ["The Blighted Stretch", "Ashfall Clearing", "The Scarred Moor", "Hollow Creek Bend"],
  },
  ruins: {
    horror: ["The Shattered Asylum", "Tombtown Ruins", "The Broken Cathedral", "Plaguewatch Remains"],
    funny: ["The Oops-We-Forgot-This-Place", "Rubble Village (Now With More Rubble)", "Old Snoreton"],
    epic: ["The Fallen Citadel", "Ruins of Sunhold", "The Shattered Spire", "Remnants of Glory"],
    dark_fantasy: ["The Hollow Ruins", "Ashmark Remnants", "The Broken Vigil", "Scorched Foundations"],
  },
  fortress: {
    horror: ["Fort Dreadmaw", "The Bone Bastion", "Wailfort", "The Crimson Keep"],
    funny: ["Fort Totally-Not-Evil", "Castle Cushion", "The Bouncy Fortress", "Fort Pillow Fight"],
    epic: ["The Iron Citadel", "Valor's Bastion", "The Shining Fortress", "Dragonguard Keep"],
    dark_fantasy: ["Ironveil Fortress", "The Ashen Bastion", "Duskfall Keep", "The Hollow Garrison"],
  },
  dungeon_entrance: {
    horror: ["The Gaping Maw", "Descent of Whispers", "The Bleeding Gate", "Wormhole Entry"],
    funny: ["The Sketchy Hole", "Dungeon Entrance (Free Parking)", "The Uh-Oh Cavern"],
    epic: ["The Hero's Descent", "Gate of Trials", "The Proving Mouth", "Threshold of Legends"],
    dark_fantasy: ["The Sunken Gate", "Maw of the Abyss", "The Ashen Descent", "Hollow Entry"],
  },
};

const BUILDING_NAMES: Record<string, string[]> = {
  tavern: ["The Rusty Tankard", "The Sleeping Dragon", "The Broken Barrel", "The Wanderer's Rest", "The Last Pint"],
  shop: ["The Iron Shelf", "Odds & Ends", "The Dusty Counter", "Traveler's Provisions", "The Gilded Crate"],
  temple: ["Shrine of the Old Gods", "The Silent Chapel", "Temple of Forgotten Prayers", "The Stone Altar"],
  house: ["An Old Cottage", "A Weathered Dwelling", "A Crumbling Homestead", "A Sturdy House"],
  castle: ["The Grand Keep", "The Lord's Hall", "The Throne Fortress", "The High Tower"],
  dungeon: ["The Dark Descent", "The Deep Stairs", "The Forgotten Passage", "The Abyss Entrance"],
  ruins: ["Crumbling Structure", "The Old Foundation", "Collapsed Tower Base", "Rubble Heap"],
};

function generateBuildingPositions(
  areaType: AreaType,
  gridWidth: number,
  gridHeight: number,
): BuildingPosition[] {
  const config = AREA_CONFIG[areaType];
  const count = randInt(config.buildingCount[0], config.buildingCount[1]);
  const types = BUILDING_TYPES_BY_AREA[areaType];
  const positions: BuildingPosition[] = [];
  const used = new Set<string>();

  for (let i = 0; i < count; i++) {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = randInt(1, gridWidth - 2);
      y = randInt(1, gridHeight - 2);
      attempts++;
    } while (used.has(`${x},${y}`) && attempts < 20);

    if (attempts >= 20) continue;
    used.add(`${x},${y}`);

    const buildingType = types[i % types.length]!;
    const namePool = BUILDING_NAMES[buildingType] ?? ["Unknown Building"];

    positions.push({
      x,
      y,
      buildingType,
      suggestedName: pick(namePool),
    });
  }

  return positions;
}

function generateAreaFallback(areaType: AreaType, theme: Theme): AreaGenResult {
  const names = AREA_NAMES[areaType][theme];
  const config = AREA_CONFIG[areaType];
  const buildings = generateBuildingPositions(areaType, config.gridWidth, config.gridHeight);

  return {
    name: pick(names),
    description: `A ${areaType.replace("_", " ")} area stretching before you. The ${theme} atmosphere hangs heavy in the air.`,
    buildings,
    features: [],
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

async function generateAreaAI(areaType: AreaType, theme: Theme, gridWidth: number, gridHeight: number): Promise<AreaGenResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const buildingCount = AREA_CONFIG[areaType].buildingCount;
  const allowedTypes = BUILDING_TYPES_BY_AREA[areaType];

  const prompt =
    `Generate a ${areaType.replace("_", " ")} area for a ${theme} fantasy world.\n` +
    `Grid: ${gridWidth}x${gridHeight} tiles.\n\n` +
    `Return ONLY valid JSON (no markdown, no code fences):\n` +
    `{\n` +
    `  "name": "<evocative area name, 2-4 words>",\n` +
    `  "description": "<2-3 sentences describing the area's look, atmosphere, and notable features>",\n` +
    `  "buildings": [\n` +
    `    { "buildingType": "<${allowedTypes.join("|")}>", "suggestedName": "<building name>" }\n` +
    `  ],\n` +
    `  "features": ["<notable terrain feature or detail>", ...]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- ${buildingCount[0]}-${buildingCount[1]} buildings\n` +
    `- Building types must be from: ${allowedTypes.join(", ")}\n` +
    `- 2-4 terrain features\n` +
    `- Match the ${theme} tone precisely`;

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    temperature: 0.9,
    system: THEME_PROMPTS[theme],
    messages: [{ role: "user", content: prompt }],
  });
  const durationMs = Date.now() - start;

  db.insert(aiUsage)
    .values({
      model: MODEL,
      feature: "area_generation",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
    })
    .catch(() => {});

  const block = response.content[0];
  if (!block || block.type !== "text") throw new Error("No text response from AI for area generation");

  const parsed = JSON.parse(block.text.trim()) as AreaGenResult;
  if (!parsed.name || !parsed.description || !parsed.buildings) {
    throw new Error("Missing required fields in AI area response");
  }

  // Sanitize
  parsed.name = sanitizeAIContent(parsed.name);
  parsed.description = sanitizeAIContent(parsed.description);
  parsed.features = (parsed.features ?? []).map(sanitizeAIContent);

  // Assign positions to AI-generated buildings
  const used = new Set<string>();
  parsed.buildings = parsed.buildings.map((b) => {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = randInt(1, gridWidth - 2);
      y = randInt(1, gridHeight - 2);
      attempts++;
    } while (used.has(`${x},${y}`) && attempts < 20);
    used.add(`${x},${y}`);

    return {
      x,
      y,
      buildingType: sanitizeAIContent(b.buildingType),
      suggestedName: sanitizeAIContent(b.suggestedName),
    };
  });

  return parsed;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate an area for the given region. Uses content library cache first,
 * falls back to AI, then to procedural fallback.
 *
 * Returns area data + building positions for the caller to insert.
 */
export async function generateArea(
  regionId: string,
  areaType: AreaType,
  position: { x: number; y: number },
  theme: Theme,
): Promise<GenerateAreaResult> {
  const config = AREA_CONFIG[areaType];

  const result = (await selectOrGenerate(db, {
    type: "area" as never,
    theme,
    tags: ["world-gen", `area:${areaType}`],
    generate: async () => {
      if (isAIEnabled()) {
        return await generateAreaAI(areaType, theme, config.gridWidth, config.gridHeight);
      }
      return generateAreaFallback(areaType, theme);
    },
  })) as AreaGenResult;

  // If cached result lacks building positions, generate them
  const buildings = result.buildings?.length
    ? result.buildings
    : generateBuildingPositions(areaType, config.gridWidth, config.gridHeight);

  return {
    area: {
      regionId,
      name: result.name,
      description: result.description,
      areaType,
      gridWidth: config.gridWidth,
      gridHeight: config.gridHeight,
      position,
      connections: [],
      metadata: {
        features: result.features ?? [],
        buildings: buildings.map((b) => ({
          buildingType: b.buildingType,
          suggestedName: b.suggestedName,
        })),
        terrain: areaType,
      },
      generatedBy: isAIEnabled() ? "ai" : "template",
    },
    buildings,
  };
}
