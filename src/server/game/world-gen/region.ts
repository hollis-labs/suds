// ─── Region Generator ────────────────────────────────────────────────────────
//
// AI-powered region generation for the world hierarchy.
// Uses selectOrGenerate from content-library.ts: checks cache first, AI if needed.
// Returns data ready for insertion — does NOT commit to DB.

import type { Theme } from "@/lib/constants";
import type { NewRegion } from "@/server/db/schema";
import { selectOrGenerate } from "@/server/game/content-library";
import { isAIEnabled } from "@/server/game/ai";
import { sanitizeAIContent } from "@/server/game/safety";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { aiUsage } from "@/server/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RegionGenResult {
  name: string;
  description: string;
  theme: string;
  landmarks: string[];
  faction: string;
  biome: string;
}

export interface GenerateRegionOptions {
  nameHint?: string; // optional name override (e.g. from seed data)
}

// ─── Theme Flavor ───────────────────────────────────────────────────────────

const BIOMES: Record<Theme, string[]> = {
  horror: ["blighted marsh", "dead forest", "haunted coastline", "cursed plains", "bone wastes"],
  funny: ["candy mountains", "pillow valleys", "snack swamp", "sparkle desert", "nap meadows"],
  epic: ["crystal highlands", "sunlit plains", "golden coast", "ancient forest", "stormpeaks"],
  dark_fantasy: ["ashen wastes", "shadowed vale", "iron ridges", "corrupted fen", "twilight steppe"],
};

const FACTION_PREFIXES: Record<Theme, string[]> = {
  horror: ["The Hollow", "The Wailing", "The Pale", "The Rotting", "The Silent"],
  funny: ["The Slightly Annoyed", "The Over-Caffeinated", "The Very Polite", "The Confused"],
  epic: ["The Golden", "The Eternal", "The Radiant", "The Unbroken", "The Sovereign"],
  dark_fantasy: ["The Ashen", "The Iron", "The Forsaken", "The Last", "The Hollow"],
};

const FACTION_SUFFIXES = ["Order", "Watch", "Covenant", "Brotherhood", "Guard", "Remnant", "Circle"];

// ─── Fallback Generator ─────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateRegionFallback(theme: Theme): RegionGenResult {
  const biome = pick(BIOMES[theme]);
  const faction = `${pick(FACTION_PREFIXES[theme])} ${pick(FACTION_SUFFIXES)}`;

  const REGION_NAMES: Record<Theme, string[]> = {
    horror: ["The Bleakwood", "Moaning Fen", "Ashfall Reach", "The Pale Wastes", "Carrion Coast"],
    funny: ["Giggletop Hills", "Snoreshore", "The Bumbling Moors", "Noodle Valley", "Flapdoodle Flats"],
    epic: ["Sunspire Summit", "The Shining Coast", "Everbloom Dale", "Stormrend Heights", "The Golden Reach"],
    dark_fantasy: ["The Withered March", "Duskhollow", "Cinderfall Basin", "The Scarred Expanse", "Hollow Drift"],
  };

  const LANDMARKS_POOL: Record<Theme, string[]> = {
    horror: ["The Screaming Well", "Gallows Crossing", "The Bone Altar", "Whisperwind Ruins", "The Sunken Chapel", "Plague Hollow"],
    funny: ["The Big Comfy Chair", "Mount Snackmore", "The Legendary Puddle", "Sir Reginald's Statue", "The Forbidden Fridge", "Wobbly Bridge"],
    epic: ["The Crystal Spire", "Dawn's Edge Citadel", "The Singing Falls", "Dragonrest Peak", "The Eternal Flame Shrine", "Starhaven Keep"],
    dark_fantasy: ["The Shattered Throne", "Ashmark Tower", "The Weeping Stones", "Blightroot Hollow", "Ironveil Gate", "The Ember Crypt"],
  };

  const name = pick(REGION_NAMES[theme]);
  const pool = LANDMARKS_POOL[theme];
  const landmarks = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => pick(pool));
  // Deduplicate
  const uniqueLandmarks = [...new Set(landmarks)].slice(0, 5);

  return {
    name,
    description: `A ${biome} stretching across the horizon. ${faction} once held dominion here, but their grip has weakened. Travelers speak of ${uniqueLandmarks[0]} with a mix of awe and dread.`,
    theme,
    landmarks: uniqueLandmarks,
    faction,
    biome,
  };
}

// ─── AI Generator ───────────────────────────────────────────────────────────

const MODEL = "claude-haiku-4-5-20251001";

const THEME_PROMPTS: Record<Theme, string> = {
  horror:
    "You write for a horror-themed fantasy world. Tone: creepy, unsettling, atmospheric dread. Avoid gratuitous gore.",
  funny:
    "You write for a comedy-themed fantasy world. Tone: absurd, punny, lighthearted. Break the fourth wall occasionally.",
  epic:
    "You write for an epic/heroic fantasy world. Tone: grand, mythological, sweeping. Every place feels legendary.",
  dark_fantasy:
    "You write for a dark fantasy world. Tone: bleak, morally gray, tragic beauty. Think Dark Souls or The Witcher.",
};

async function generateRegionAI(theme: Theme): Promise<RegionGenResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const prompt =
    `Generate a fantasy region for a ${theme} themed world.\n\n` +
    `Return ONLY valid JSON (no markdown, no code fences) with this structure:\n` +
    `{\n` +
    `  "name": "<evocative region name, 2-4 words>",\n` +
    `  "description": "<2-3 sentences of rich lore describing the region's geography, history, and current state>",\n` +
    `  "landmarks": ["<landmark 1>", "<landmark 2>", "<landmark 3>"],\n` +
    `  "faction": "<name of the faction/group that inhabits or controls this region>",\n` +
    `  "biome": "<one-word or two-word biome type like 'haunted marsh' or 'crystal highlands'>"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- 3-5 landmarks with evocative names\n` +
    `- Description should hint at dangers and mysteries\n` +
    `- Faction name should fit the theme\n` +
    `- Make it feel like a real place adventurers would want to explore`;

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    temperature: 0.9,
    system: THEME_PROMPTS[theme],
    messages: [{ role: "user", content: prompt }],
  });
  const durationMs = Date.now() - start;

  // Track AI usage
  db.insert(aiUsage)
    .values({
      model: MODEL,
      feature: "region_generation",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs,
    })
    .catch(() => {});

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("No text response from AI for region generation");
  }

  const parsed = JSON.parse(block.text.trim()) as RegionGenResult;

  // Validate
  if (!parsed.name || !parsed.description || !parsed.landmarks || !parsed.faction || !parsed.biome) {
    throw new Error("Missing required fields in AI region response");
  }

  // Sanitize
  parsed.name = sanitizeAIContent(parsed.name);
  parsed.description = sanitizeAIContent(parsed.description);
  parsed.faction = sanitizeAIContent(parsed.faction);
  parsed.biome = sanitizeAIContent(parsed.biome);
  parsed.landmarks = parsed.landmarks.map(sanitizeAIContent);

  return { ...parsed, theme };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a region for the given world. Uses content library cache first,
 * falls back to AI, then to procedural fallback.
 *
 * Returns data ready for DB insertion — caller handles the insert.
 */
export async function generateRegion(
  worldId: string,
  theme: Theme,
  position: { x: number; y: number },
  options?: GenerateRegionOptions,
): Promise<Omit<NewRegion, "id">> {
  const result = (await selectOrGenerate(db, {
    type: "region" as never, // Cast needed until content-library types are expanded in Task 4
    theme,
    tags: ["world-gen", `biome:${theme}`],
    generate: async () => {
      if (isAIEnabled()) {
        return await generateRegionAI(theme);
      }
      return generateRegionFallback(theme);
    },
  })) as RegionGenResult;

  return {
    worldId,
    name: options?.nameHint ?? result.name,
    description: result.description,
    theme: result.theme ?? theme,
    position,
    connections: [],
    metadata: {
      landmarks: result.landmarks,
      faction: result.faction,
      biome: result.biome,
    },
    generatedBy: isAIEnabled() ? "ai" : "template",
  };
}
