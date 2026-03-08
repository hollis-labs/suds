// ─── Content Library Module ──────────────────────────────────────────────────
//
// Stores AI-generated content for cross-character / cross-session reuse.
// Uses a weighted algorithm to decide whether to generate new content or
// reuse existing library entries, reducing AI API calls over time.

import { eq, and, sql, gte, arrayContains } from "drizzle-orm";
import { contentLibrary } from "@/server/db/schema";
import { generateTemplateContent, type TemplateContentType } from "@/server/game/templates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DbClient = typeof import("@/server/db").db;

type ContentType =
  | "room_description"
  | "npc_dialogue"
  | "lore_fragment"
  | "quest"
  | "region"
  | "area"
  | "building"
  | "floor_layout";

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

  // Step 3: Template-first lookup — prefer high-quality curated content
  const templateHit = await selectTemplate(db, type, theme, tags);
  if (templateHit !== null) {
    return templateHit;
  }

  // Step 4: Calculate reuse probability
  const reuseChance = Math.min(0.8, count / (count + 10));

  // Step 5: Roll dice
  if (Math.random() < reuseChance) {
    // Attempt to reuse from library
    const reused = await selectFromLibrary(db, type, theme, tags);
    if (reused !== null) {
      return reused;
    }
    // If selection somehow failed, fall through to generate
  }

  // Step 6: Generate new content
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

/**
 * Select a template entry (quality >= 4) for the given type and theme.
 * Templates are high-quality curated content that should be preferred.
 * Returns null if no templates exist or random chance skips (30% chance to skip
 * templates to allow variety).
 */
async function selectTemplate(
  db: DbClient,
  type: ContentType,
  theme: string,
  tags: string[],
): Promise<string | object | null> {
  // 30% chance to skip templates for variety
  if (Math.random() < 0.3) return null;

  const templates = await db
    .select()
    .from(contentLibrary)
    .where(
      and(
        eq(contentLibrary.type, type),
        eq(contentLibrary.theme, theme),
        gte(contentLibrary.quality, 4),
      )
    );

  if (templates.length === 0) return null;

  // Score by tag match, prefer less-used templates
  const scored = templates.map((entry) => {
    let weight = 1;
    const entryTags = (entry.tags as string[]) ?? [];
    const matchingTags = tags.filter((t) => entryTags.includes(t)).length;
    if (matchingTags > 0) weight *= Math.pow(2, matchingTags);
    weight *= 4 / (1 + (entry.usageCount ?? 0));
    return { entry, weight };
  });

  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const { entry, weight } of scored) {
    roll -= weight;
    if (roll <= 0) {
      // Update usage tracking
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

  return null;
}

// ---------------------------------------------------------------------------
// Template Management (for admin use)
// ---------------------------------------------------------------------------

/**
 * Promote a content library entry to template status (quality = 5, tagged).
 */
export async function promoteToTemplate(
  db: DbClient,
  contentId: string,
): Promise<void> {
  const [entry] = await db
    .select()
    .from(contentLibrary)
    .where(eq(contentLibrary.id, contentId));

  if (!entry) throw new Error(`Content entry not found: ${contentId}`);

  const existingTags = (entry.tags as string[]) ?? [];
  const newTags = existingTags.includes("template")
    ? existingTags
    : [...existingTags, "template"];

  await db
    .update(contentLibrary)
    .set({ quality: 5, tags: newTags })
    .where(eq(contentLibrary.id, contentId));
}

/**
 * Update a content library entry's quality rating.
 */
export async function updateContentQuality(
  db: DbClient,
  contentId: string,
  quality: number,
): Promise<void> {
  const clamped = Math.max(1, Math.min(5, quality));
  await db
    .update(contentLibrary)
    .set({ quality: clamped })
    .where(eq(contentLibrary.id, contentId));
}

/**
 * Get template statistics: counts, reuse rates, quality distribution.
 */
export async function getTemplateStats(
  db: DbClient,
): Promise<{
  totalEntries: number;
  templateCount: number;
  byType: { type: string; total: number; templates: number }[];
  averageQuality: number;
  totalReuses: number;
}> {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentLibrary);

  const [templateResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentLibrary)
    .where(gte(contentLibrary.quality, 4));

  const byTypeRows = await db
    .select({
      type: contentLibrary.type,
      total: sql<number>`count(*)::int`,
      templates: sql<number>`count(*) filter (where ${contentLibrary.quality} >= 4)::int`,
    })
    .from(contentLibrary)
    .groupBy(contentLibrary.type);

  const [qualityResult] = await db
    .select({
      avg: sql<number>`coalesce(avg(${contentLibrary.quality}), 0)::float`,
    })
    .from(contentLibrary);

  const [reuseResult] = await db
    .select({
      total: sql<number>`coalesce(sum(${contentLibrary.usageCount}), 0)::int`,
    })
    .from(contentLibrary);

  return {
    totalEntries: totalResult?.count ?? 0,
    templateCount: templateResult?.count ?? 0,
    byType: byTypeRows,
    averageQuality: qualityResult?.avg ?? 0,
    totalReuses: reuseResult?.total ?? 0,
  };
}
