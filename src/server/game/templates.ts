// ─── Mad-Lib Template Engine ─────────────────────────────────────────────────
//
// Lightweight template system for generating varied game content without AI.
// Templates use {{slot_name}} placeholders filled from themed word banks.
// Used as a cheap alternative to Claude Haiku for room descriptions,
// lore fragments, and NPC greetings.

import type { Theme } from "@/lib/constants";
import templateData from "@/server/gamedata/templates.json";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TemplateBank {
  templates: string[];
  slots: Record<string, string[]>;
}

export type TemplateContentType =
  | "room_description"
  | "lore_fragment"
  | "npc_greeting";

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Pick a random element from an array.
 */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Fill all {{slot}} placeholders in a template string with random values
 * from the corresponding word bank. Each occurrence of the same slot name
 * in a single template gets an independent random pick, so you can use
 * {{adjective}} twice and potentially get two different adjectives.
 */
function fillTemplate(template: string, slots: Record<string, string[]>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, slotName: string) => {
    const options = slots[slotName];
    if (!options || options.length === 0) {
      return slotName; // fallback: just use the slot name as-is
    }
    return pick(options);
  });
}

/**
 * Generate content from a template bank: pick a random template,
 * then fill all its slots with random values.
 */
export function generateFromTemplate(bank: TemplateBank): string {
  const template = pick(bank.templates);
  return fillTemplate(template, bank.slots);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a piece of template-based content for a given type and theme.
 * This is a cheap alternative to AI generation — no API calls, pure
 * random substitution from curated word banks.
 *
 * @param type - The content type: "room_description", "lore_fragment", or "npc_greeting"
 * @param theme - One of the game themes: "horror", "funny", "epic", "dark_fantasy"
 * @returns A generated string with all template slots filled
 */
export function generateTemplateContent(
  type: TemplateContentType,
  theme: string,
): string {
  const typeBank = templateData[type] as
    | Record<string, TemplateBank>
    | undefined;
  if (!typeBank) {
    return `[Unknown content type: ${type}]`;
  }

  const themeBank = typeBank[theme as Theme] as TemplateBank | undefined;
  if (!themeBank) {
    return `[Unknown theme: ${theme}]`;
  }

  return generateFromTemplate(themeBank);
}
