// ─── AI Content Generation Module ────────────────────────────────────────────
//
// Uses Claude claude-haiku-4-5-20251001 to generate rich game content with automatic fallback
// to the existing word bank system if AI is unavailable or fails.

import Anthropic from "@anthropic-ai/sdk";
import type { Theme, RoomType } from "@/lib/constants";
import type { DialogueNode } from "@/lib/types";
import { generateRoomDescription } from "@/server/game/world";
import { generateDialogueTree } from "@/server/game/npc";
import { sanitizeAIContent } from "@/server/game/safety";
import themesData from "@/server/gamedata/themes.json";
import { db } from "@/server/db";
import { aiUsage } from "@/server/db/schema";

// ─── Singleton Client ────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;
let aiEnabled = false;

function getClient(): Anthropic | null {
  if (anthropicClient) return anthropicClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "placeholder" || apiKey.trim() === "") {
    aiEnabled = false;
    return null;
  }

  try {
    anthropicClient = new Anthropic({ apiKey });
    aiEnabled = true;
    return anthropicClient;
  } catch {
    aiEnabled = false;
    return null;
  }
}

/**
 * Returns true if the Anthropic API key is set and valid (not "placeholder").
 */
export function isAIEnabled(): boolean {
  if (anthropicClient) return aiEnabled;
  // Attempt initialization to determine status
  getClient();
  return aiEnabled;
}

// ─── Theme System Prompts ────────────────────────────────────────────────────

const THEME_SYSTEM_PROMPTS: Record<Theme, string> = {
  horror:
    "You are a game content writer for a dungeon crawler with a HORROR theme. " +
    "Your tone is creepy, unsettling, and full of psychological dread. " +
    "Use vivid sensory details — sounds, smells, textures — that unsettle the reader. " +
    "Avoid gratuitous gore; focus on atmosphere and the unknown. " +
    "Keep content appropriate for a T-rated game.",
  funny:
    "You are a game content writer for a dungeon crawler with a FUNNY/COMEDY theme. " +
    "Your tone is humorous, absurd, and lighthearted. Puns are welcome and encouraged. " +
    "Break the fourth wall occasionally. Reference common game tropes and subvert them. " +
    "Think Terry Pratchett meets Monty Python. Keep it family-friendly fun.",
  epic:
    "You are a game content writer for a dungeon crawler with an EPIC/HEROIC theme. " +
    "Your tone is grand, heroic, and mythological. Use sweeping language and " +
    "references to ancient prophecies, legendary heroes, and cosmic forces. " +
    "Think Tolkien or Greek mythology. Every moment should feel monumental.",
  dark_fantasy:
    "You are a game content writer for a dungeon crawler with a DARK FANTASY theme. " +
    "Your tone is bleak, grim, and morally gray. The world is corrupted and tragic. " +
    "Characters are flawed, hope is scarce, and survival is never guaranteed. " +
    "Think Dark Souls or The Witcher. Beauty exists, but it is always tinged with loss.",
};

// ─── Helper ──────────────────────────────────────────────────────────────────

const MODEL = "claude-haiku-4-5-20251001";

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  feature: string,
): Promise<string> {
  const client = getClient();
  if (!client) {
    throw new Error("AI client not available");
  }

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const durationMs = Date.now() - start;

  // Fire and forget — don't block the response
  db.insert(aiUsage).values({
    model: MODEL,
    feature,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs,
  }).catch(() => {}); // silent fail

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("No text response from AI");
  }

  // Strip markdown headers/formatting the model sometimes adds
  let text = block.text.trim();
  text = text.replace(/^#+\s+.*\n+/gm, "").trim();

  return sanitizeAIContent(text);
}

// ─── Room Description ────────────────────────────────────────────────────────

/**
 * Generate a rich 2-3 sentence room description using AI.
 * Falls back to the word bank system on failure.
 */
export async function generateRoomDescriptionAI(
  theme: Theme,
  roomType: RoomType,
  roomName: string,
  depth: number,
): Promise<string> {
  try {
    if (!isAIEnabled()) {
      return generateRoomDescription(theme, roomType);
    }

    const depthLabel =
      depth <= 2 ? "shallow" : depth <= 5 ? "mid-level" : "deep";

    const prompt =
      `Generate a room description for a ${depthLabel} dungeon room.\n` +
      `Room name: "${roomName}"\n` +
      `Room type: ${roomType.replace("_", " ")}\n` +
      `Depth: ${depth}\n\n` +
      `Write exactly 2-3 sentences. Be vivid and atmospheric. ` +
      `Do not include the room name in the description. ` +
      `Do not use second person ("you"). Use present tense descriptions of the space itself.`;

    return await callClaude(THEME_SYSTEM_PROMPTS[theme], prompt, 200, "room_description");
  } catch {
    return generateRoomDescription(theme, roomType);
  }
}

// ─── NPC Dialogue ────────────────────────────────────────────────────────────

/**
 * Generate a full dialogue tree for an NPC using AI.
 * Returns the same shape as generateDialogueTree from npc.ts.
 * Falls back to the word bank system on failure.
 */
export async function generateNPCDialogueAI(
  theme: Theme,
  npcName: string,
  depth: number,
): Promise<Record<string, DialogueNode>> {
  try {
    if (!isAIEnabled()) {
      return generateDialogueTree(theme);
    }

    const depthLabel =
      depth <= 2 ? "near the entrance" : depth <= 5 ? "mid-dungeon" : "deep in the dungeon";

    const prompt =
      `Generate a dialogue tree for an NPC named "${npcName}" found ${depthLabel} (depth ${depth}).\n\n` +
      `Return ONLY valid JSON (no markdown, no code fences) with this exact structure:\n` +
      `{\n` +
      `  "root": { "id": "root", "text": "<greeting>", "choices": [{"text": "<option>", "nextId": "<node_id>"}, ...] },\n` +
      `  "dungeon_info": { "id": "dungeon_info", "text": "<info about the dungeon>", "choices": [...] },\n` +
      `  "lore_info": { "id": "lore_info", "text": "<lore about the world>", "choices": [...] },\n` +
      `  "rumors": { "id": "rumors", "text": "<a rumor>", "choices": [...] },\n` +
      `  "quest_hint": { "id": "quest_hint", "text": "<a task the NPC needs help with>", "choices": [...] },\n` +
      `  "accept_quest": { "id": "accept_quest", "text": "<grateful response>", "choices": [...] },\n` +
      `  "farewell": { "id": "farewell", "text": "<goodbye>", "choices": [{"text": "Wait, one more thing...", "nextId": "root"}, {"text": "Goodbye", "nextId": null}] }\n` +
      `}\n\n` +
      `Rules:\n` +
      `- root choices must include options leading to dungeon_info, lore_info, rumors, quest_hint, and farewell\n` +
      `- Each non-farewell node should have "Back" (nextId: "root") and "Farewell" (nextId: "farewell") choices\n` +
      `- quest_hint must have a choice with "action": "accept_quest" pointing to accept_quest\n` +
      `- All dialogue should be in-character for "${npcName}" and fit the theme\n` +
      `- Keep each text field to 1-3 sentences`;

    const raw = await callClaude(THEME_SYSTEM_PROMPTS[theme], prompt, 400, "npc_dialogue");

    const parsed = JSON.parse(raw) as Record<string, DialogueNode>;

    // Validate the required nodes exist
    const requiredNodes = [
      "root",
      "dungeon_info",
      "lore_info",
      "rumors",
      "quest_hint",
      "accept_quest",
      "farewell",
    ];
    for (const nodeId of requiredNodes) {
      if (!parsed[nodeId] || !parsed[nodeId].text || !parsed[nodeId].choices) {
        throw new Error(`Missing or invalid node: ${nodeId}`);
      }
    }

    // Sanitize all text fields
    for (const node of Object.values(parsed)) {
      node.text = sanitizeAIContent(node.text);
      for (const choice of node.choices) {
        choice.text = sanitizeAIContent(choice.text);
      }
    }

    return parsed;
  } catch {
    return generateDialogueTree(theme);
  }
}

// ─── Lore Fragment ───────────────────────────────────────────────────────────

/**
 * Generate a unique lore fragment for a room using AI.
 * Falls back to a random lore fragment from themes.json on failure.
 */
export async function generateLoreFragmentAI(
  theme: Theme,
  depth: number,
): Promise<string> {
  try {
    if (!isAIEnabled()) {
      return pickFallbackLore(theme);
    }

    const depthLabel =
      depth <= 2 ? "shallow" : depth <= 5 ? "mid-level" : "deep";

    const prompt =
      `Generate a single lore fragment found in a ${depthLabel} dungeon room (depth ${depth}).\n\n` +
      `This could be: an inscription on a wall, a journal entry, graffiti, ` +
      `a plaque, a carved message, or a scrawled warning.\n\n` +
      `Write exactly 1-2 sentences. Include a framing line like ` +
      `"Carved into the wall:" or "A faded note reads:" before the actual content.\n` +
      `Match the theme's tone precisely.`;

    return await callClaude(THEME_SYSTEM_PROMPTS[theme], prompt, 200, "lore_fragment");
  } catch {
    return pickFallbackLore(theme);
  }
}

function pickFallbackLore(theme: Theme): string {
  const fragments = themesData[theme].loreFragments;
  return fragments[Math.floor(Math.random() * fragments.length)]!;
}

// ─── Quest Generation ────────────────────────────────────────────────────────

export interface QuestDescription {
  title: string;
  description: string;
  objective: string;
  type: "fetch" | "kill";
}

/**
 * Generate a simple fetch or kill quest description using AI.
 * Falls back to a basic procedural quest on failure.
 */
export async function generateQuestAI(
  theme: Theme,
  npcName: string,
  depth: number,
): Promise<QuestDescription> {
  try {
    if (!isAIEnabled()) {
      return generateFallbackQuest(theme, npcName, depth);
    }

    const questType = Math.random() < 0.5 ? "fetch" : "kill";
    const depthLabel =
      depth <= 2 ? "shallow" : depth <= 5 ? "mid-level" : "deep";

    const prompt =
      `Generate a ${questType} quest given by an NPC named "${npcName}" in a ${depthLabel} dungeon area (depth ${depth}).\n\n` +
      `Return ONLY valid JSON (no markdown, no code fences) with this structure:\n` +
      `{\n` +
      `  "title": "<short quest title, 3-6 words>",\n` +
      `  "description": "<1-2 sentence quest description from the NPC's perspective>",\n` +
      `  "objective": "<brief objective like 'Find the lost amulet' or 'Slay the corrupted guardian'>",\n` +
      `  "type": "${questType}"\n` +
      `}\n\n` +
      `The quest should feel personal to the NPC and fit the theme.`;

    const raw = await callClaude(THEME_SYSTEM_PROMPTS[theme], prompt, 300, "quest");
    const parsed = JSON.parse(raw) as QuestDescription;

    // Validate fields
    if (!parsed.title || !parsed.description || !parsed.objective || !parsed.type) {
      throw new Error("Missing required quest fields");
    }

    // Sanitize
    parsed.title = sanitizeAIContent(parsed.title);
    parsed.description = sanitizeAIContent(parsed.description);
    parsed.objective = sanitizeAIContent(parsed.objective);

    // Ensure type is valid
    if (parsed.type !== "fetch" && parsed.type !== "kill") {
      parsed.type = questType;
    }

    return parsed;
  } catch {
    return generateFallbackQuest(theme, npcName, depth);
  }
}

// ─── Fallback Quest Generator ────────────────────────────────────────────────

const FALLBACK_QUESTS: Record<Theme, { fetch: QuestDescription[]; kill: QuestDescription[] }> = {
  horror: {
    fetch: [
      {
        title: "The Lost Locket",
        description: "I lost a locket deeper in these halls. It holds the only portrait of someone I've lost. Please, bring it back to me.",
        objective: "Find the lost locket in the deeper rooms",
        type: "fetch",
      },
    ],
    kill: [
      {
        title: "End the Scratching",
        description: "Something has been scratching at the walls for days. I can't sleep. I can't think. Please, make it stop.",
        objective: "Slay the creature causing the scratching sounds",
        type: "kill",
      },
    ],
  },
  funny: {
    fetch: [
      {
        title: "Lord Cluckington III",
        description: "I lost my pet chicken somewhere in the dungeon. His name is Lord Cluckington III. He's wearing a tiny helmet. Don't ask.",
        objective: "Find Lord Cluckington III the chicken",
        type: "fetch",
      },
    ],
    kill: [
      {
        title: "The Rude Mimic",
        description: "There's a mimic down there that keeps insulting passersby. Its trash talk is devastating morale. Put an end to it, will you?",
        objective: "Defeat the trash-talking mimic",
        type: "kill",
      },
    ],
  },
  epic: {
    fetch: [
      {
        title: "The Sacred Relic",
        description: "An ancient relic was stolen from the Shrine of Light. If you could recover it, the blessings of the old gods would be yours.",
        objective: "Recover the sacred relic from the depths",
        type: "fetch",
      },
    ],
    kill: [
      {
        title: "The Fallen Guardian",
        description: "An ancient guardian has gone mad, attacking all who approach. It was once noble. Grant it an honorable end.",
        objective: "Defeat the corrupted ancient guardian",
        type: "kill",
      },
    ],
  },
  dark_fantasy: {
    fetch: [
      {
        title: "A Final Mercy",
        description: "My companion fell to the corruption three days ago. They carried a ring — our promise. Bring it back so I can remember who they were.",
        objective: "Retrieve the ring from the corrupted companion",
        type: "fetch",
      },
    ],
    kill: [
      {
        title: "End Their Suffering",
        description: "My companion fell to the corruption. They wouldn't want to exist like that. Find them, and end their suffering.",
        objective: "Slay the corrupted companion",
        type: "kill",
      },
    ],
  },
};

function generateFallbackQuest(
  theme: Theme,
  _npcName: string,
  _depth: number,
): QuestDescription {
  const questType = Math.random() < 0.5 ? "fetch" : "kill";
  const quests = FALLBACK_QUESTS[theme][questType];
  return { ...quests[Math.floor(Math.random() * quests.length)]! };
}
