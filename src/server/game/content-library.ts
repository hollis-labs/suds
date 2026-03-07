// ─── Content Library Module ──────────────────────────────────────────────────
//
// Stores AI-generated content for cross-character / cross-session reuse.
// Uses a weighted algorithm to decide whether to generate new content or
// reuse existing library entries, reducing AI API calls over time.

import { eq, and, sql } from "drizzle-orm";
import { contentLibrary } from "@/server/db/schema";
import { generateTemplateContent, type TemplateContentType } from "@/server/game/templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DbClient = typeof import("@/server/db").db;

type ContentType = "room_description" | "npc_dialogue" | "lore_fragment" | "quest";

export interface SelectOrGenerateOptions {
  type: ContentType;
  theme: string;
  tags: string[]; // context tags for matching (e.g. ["deep", "store"])
  generate: () => Promise<string | object>; // the AI generation function
  minLibrarySize?: number; // default 5 — below this, always generate
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Store generated content in the library for future reuse.
 */
export async function storeContent(
  db: DbClient,
  type: ContentType,
  theme: string,
  tags: string[],
  content: string | object,
): Promise<void> {
  await db.insert(contentLibrary).values({
    type,
    theme,
    tags,
    content: typeof content === "string" ? content : content,
  });
}

/**
 * The main decision function: either reuse an existing library entry
 * or generate new content via AI (and store it for future reuse).
 *
 * Algorithm:
 * 1. Count matching library items (same type + theme)
 * 2. If count < minLibrarySize: generate new, store, return
 * 3. Calculate reuse probability: reuseChance = min(0.8, count / (count + 10))
 * 4. Roll dice — if reuse, select weighted by tag match, recency, usage
 * 5. If generating new: call generate(), store result, return
 * 6. If reusing: increment usageCount and lastUsedAt, return content
 */
export async function selectOrGenerate(
  db: DbClient,
  options: SelectOrGenerateOptions,
): Promise<string | object> {
  const { type, theme, tags, generate, minLibrarySize = 5 } = options;

  // Step 1: Count matching library items
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentLibrary)
    .where(and(eq(contentLibrary.type, type), eq(contentLibrary.theme, theme)));

  const count = countResult?.count ?? 0;

  // Step 2: If below minimum, always generate new content
  if (count < minLibrarySize) {
    return await generateAndStore(db, type, theme, tags, generate);
  }

  // Step 3: Calculate reuse probability
  const reuseChance = Math.min(0.8, count / (count + 10));

  // Step 4: Roll dice
  if (Math.random() < reuseChance) {
    // Attempt to reuse from library
    const reused = await selectFromLibrary(db, type, theme, tags);
    if (reused !== null) {
      return reused;
    }
    // If selection somehow failed, fall through to generate
  }

  // Step 5: Generate new content
  return await generateAndStore(db, type, theme, tags, generate);
}

/**
 * Returns counts for monitoring content library growth.
 */
export async function getLibraryStats(
  db: DbClient,
  type?: ContentType,
  theme?: string,
): Promise<{ type: string; theme: string; count: number }[]> {
  const conditions = [];
  if (type) conditions.push(eq(contentLibrary.type, type));
  if (theme) conditions.push(eq(contentLibrary.theme, theme));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      type: contentLibrary.type,
      theme: contentLibrary.theme,
      count: sql<number>`count(*)::int`,
    })
    .from(contentLibrary)
    .where(whereClause)
    .groupBy(contentLibrary.type, contentLibrary.theme);

  return rows;
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Generate new content, store it in the library, and return it.
 * Falls back to template generation if AI generation fails.
 */
async function generateAndStore(
  db: DbClient,
  type: ContentType,
  theme: string,
  tags: string[],
  generate: () => Promise<string | object>,
): Promise<string | object> {
  let content: string | object;
  try {
    content = await generate();
  } catch {
    // AI failed — fall back to template generation for supported types
    const templateTypes: TemplateContentType[] = ["room_description", "lore_fragment", "npc_greeting"];
    if (templateTypes.includes(type as TemplateContentType)) {
      content = generateTemplateContent(type as TemplateContentType, theme);
    } else {
      throw new Error(`Content generation failed for type: ${type}`);
    }
  }
  // Store in library (fire and forget — don't block the response)
  storeContent(db, type, theme, tags, content).catch(() => {});
  return content;
}

/**
 * Select a library entry using weighted scoring:
 * - Prefer items with matching tags (2x weight)
 * - Prefer less-recently-used items (inverse recency)
 * - Prefer less-used items overall (inverse usage count)
 */
async function selectFromLibrary(
  db: DbClient,
  type: ContentType,
  theme: string,
  tags: string[],
): Promise<string | object | null> {
  // Fetch all candidates (same type + theme)
  const candidates = await db
    .select()
    .from(contentLibrary)
    .where(and(eq(contentLibrary.type, type), eq(contentLibrary.theme, theme)));

  if (candidates.length === 0) return null;

  // Score each candidate
  const now = Date.now();
  const scored = candidates.map((entry) => {
    let weight = 1;

    // Tag matching: 2x weight for each matching tag
    const entryTags = (entry.tags as string[]) ?? [];
    const matchingTags = tags.filter((t) => entryTags.includes(t)).length;
    if (matchingTags > 0) {
      weight *= Math.pow(2, matchingTags);
    }

    // Inverse usage count: less-used items get higher weight
    // usageCount of 0 -> weight 4, 1 -> 2, 2 -> 1.33, etc.
    weight *= 4 / (1 + (entry.usageCount ?? 0));

    // Inverse recency: older last-used items get higher weight
    // Items never used get highest recency bonus
    if (entry.lastUsedAt) {
      const hoursSinceUse = (now - entry.lastUsedAt.getTime()) / (1000 * 60 * 60);
      // More hours since last use = higher weight (capped at 10x)
      weight *= Math.min(10, 1 + hoursSinceUse / 24);
    } else {
      // Never used — maximum recency bonus
      weight *= 10;
    }

    return { entry, weight };
  });

  // Weighted random selection
  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const { entry, weight } of scored) {
    roll -= weight;
    if (roll <= 0) {
      // Update usage tracking (fire and forget)
      db.update(contentLibrary)
        .set({
          usageCount: sql`${contentLibrary.usageCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(contentLibrary.id, entry.id))
        .catch(() => {});

      return entry.content as string | object;
    }
  }

  // Fallback: return last candidate (shouldn't reach here normally)
  const fallback = scored[scored.length - 1]!;
  db.update(contentLibrary)
    .set({
      usageCount: sql`${contentLibrary.usageCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq(contentLibrary.id, fallback.entry.id))
    .catch(() => {});

  return fallback.entry.content as string | object;
}
