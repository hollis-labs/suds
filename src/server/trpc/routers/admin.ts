import { z } from "zod";
import { sql, count, eq, isNotNull, desc, gte, and, like, between } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  users,
  characters,
  rooms,
  invites,
  gameEvents,
  aiUsage,
  contentLibrary,
  inventoryItems,
  loreEntries,
  marketplaceItems,
  npcs,
  stores,
  quests,
  worlds,
  regions,
  areas,
  buildings,
} from "@/server/db/schema";
import {
  CLASS_DEFINITIONS,
  GAME_CONFIG,
  THEMES,
  RARITY,
  ROOM_TYPES,
  XP_TABLE,
  type CharacterClass,
} from "@/lib/constants";
import {
  promoteToTemplate,
  updateContentQuality,
  getTemplateStats,
} from "@/server/game/content-library";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Static gamedata imports
import itemsData from "@/server/gamedata/items.json";
import monstersData from "@/server/gamedata/monsters.json";
import namesData from "@/server/gamedata/names.json";
import templatesData from "@/server/gamedata/templates.json";

// ─── Gamedata file helpers ──────────────────────────────────────────────────

const GAMEDATA_DIR = path.join(process.cwd(), "src/server/gamedata");

function readJsonFile<T>(filename: string): T {
  const filePath = path.join(GAMEDATA_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJsonFile(filename: string, data: unknown): void {
  const filePath = path.join(GAMEDATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

type ItemTemplate = {
  id: string;
  name: string;
  type: string;
  rarity: string;
  stats: Record<string, number>;
  basePrice: number;
  description: string;
};

type MonsterTemplate = {
  id: string;
  name: string;
  level: number;
  hpBase: number;
  ac: number;
  attack: number;
  damage: string;
  xp: number;
  abilities: string[];
  themes: string[];
};

type NamesData = {
  roomAdjectives: string[];
  roomNouns: string[];
  npcFirstNames: string[];
  npcTitles: string[];
  storeNames: string[];
};

type TemplatesData = Record<string, Record<string, { templates: string[]; slots: Record<string, string[]> }>>;

type ClassOverrides = Record<string, { name?: string; description?: string }>;

// Ability metadata (extracted from combat.ts ABILITY_DEFS without the functions)
const ABILITY_METADATA: Record<string, { mpCost: number; targetType: string }> = {
  // Fighter
  power_attack: { mpCost: 0, targetType: "single" },
  shield_block: { mpCost: 0, targetType: "self" },
  cleave: { mpCost: 5, targetType: "multi" },
  battle_cry: { mpCost: 0, targetType: "self" },
  // Wizard
  arcane_missile: { mpCost: 5, targetType: "single" },
  fireball: { mpCost: 10, targetType: "all" },
  ice_shield: { mpCost: 8, targetType: "self" },
  chain_lightning: { mpCost: 15, targetType: "multi" },
  // Rogue
  sneak_attack: { mpCost: 0, targetType: "single" },
  pick_lock: { mpCost: 0, targetType: "self" },
  dodge: { mpCost: 0, targetType: "self" },
  assassinate: { mpCost: 10, targetType: "single" },
  // Cleric
  heal: { mpCost: 8, targetType: "self" },
  smite: { mpCost: 5, targetType: "single" },
  bless: { mpCost: 10, targetType: "self" },
  divine_shield: { mpCost: 12, targetType: "self" },
  // Barbarian
  rage: { mpCost: 0, targetType: "self" },
  reckless_attack: { mpCost: 0, targetType: "single" },
  brutal_critical: { mpCost: 0, targetType: "single" },
  relentless_endurance: { mpCost: 0, targetType: "self" },
  // Bard
  bardic_inspiration: { mpCost: 5, targetType: "self" },
  cutting_words: { mpCost: 5, targetType: "single" },
  healing_word: { mpCost: 8, targetType: "self" },
  mass_inspiration: { mpCost: 12, targetType: "self" },
  // Druid
  entangle: { mpCost: 5, targetType: "all" },
  thunderwave: { mpCost: 8, targetType: "all" },
  call_lightning: { mpCost: 12, targetType: "single" },
  regenerate: { mpCost: 10, targetType: "self" },
  // Monk
  flurry_of_blows: { mpCost: 3, targetType: "single" },
  patient_defense: { mpCost: 2, targetType: "self" },
  stunning_strike: { mpCost: 5, targetType: "single" },
  quivering_palm: { mpCost: 12, targetType: "single" },
  // Paladin
  divine_smite_paladin: { mpCost: 5, targetType: "single" },
  lay_on_hands: { mpCost: 8, targetType: "self" },
  aura_of_protection: { mpCost: 8, targetType: "self" },
  holy_avenger: { mpCost: 12, targetType: "single" },
  // Ranger
  hunters_mark: { mpCost: 3, targetType: "self" },
  multiattack: { mpCost: 5, targetType: "single" },
  evasion: { mpCost: 5, targetType: "self" },
  volley: { mpCost: 10, targetType: "all" },
  // Sorcerer
  chaos_bolt: { mpCost: 5, targetType: "single" },
  shield_spell: { mpCost: 3, targetType: "self" },
  metamagic_blast: { mpCost: 12, targetType: "single" },
  wild_surge: { mpCost: 15, targetType: "all" },
  // Warlock
  eldritch_blast: { mpCost: 0, targetType: "single" },
  hex: { mpCost: 3, targetType: "self" },
  hellfire: { mpCost: 8, targetType: "single" },
  dark_pact: { mpCost: 0, targetType: "self" },
};

// Starting equipment metadata
const STARTING_EQUIPMENT: Record<string, { weapon: string | null; armor: string | null }> = {
  fighter: { weapon: "Rusty Sword", armor: "Leather Armor" },
  wizard: { weapon: "Wooden Staff", armor: null },
  rogue: { weapon: "Rusty Dagger", armor: "Leather Armor" },
  cleric: { weapon: "Wooden Mace", armor: "Chain Mail" },
  barbarian: { weapon: "Rusty Greataxe", armor: "Hide Armor" },
  bard: { weapon: "Rusty Rapier", armor: "Leather Armor" },
  druid: { weapon: "Wooden Staff", armor: "Leather Armor" },
  monk: { weapon: "Wooden Staff", armor: null },
  paladin: { weapon: "Rusty Sword", armor: "Chain Mail" },
  ranger: { weapon: "Rusty Shortbow", armor: "Leather Armor" },
  sorcerer: { weapon: "Rusty Dagger", armor: null },
  warlock: { weapon: "Rusty Shortsword", armor: "Leather Armor" },
};

// ─── Admin Guard ────────────────────────────────────────────────────────────

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const email = ctx.session.user?.email;
  if (!isAdmin(email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const adminRouter = router({
  // ─── Existing routes ────────────────────────────────────────────────────

  getStats: adminProcedure.query(async ({ ctx }) => {
    const [[userCount], [charCount], [roomCount], [inviteCount], [usedInviteCount]] =
      await Promise.all([
        ctx.db.select({ value: count() }).from(users),
        ctx.db.select({ value: count() }).from(characters),
        ctx.db.select({ value: count() }).from(rooms),
        ctx.db.select({ value: count() }).from(invites),
        ctx.db
          .select({ value: count() })
          .from(invites)
          .where(isNotNull(invites.usedBy)),
      ]);

    return {
      totalUsers: userCount?.value ?? 0,
      totalCharacters: charCount?.value ?? 0,
      totalRooms: roomCount?.value ?? 0,
      totalInvites: inviteCount?.value ?? 0,
      usedInvites: usedInviteCount?.value ?? 0,
    };
  }),

  generateInvites: adminProcedure
    .input(z.object({ count: z.number().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const codes: string[] = [];

      for (let i = 0; i < input.count; i++) {
        codes.push(generateInviteCode());
      }

      await ctx.db.insert(invites).values(
        codes.map((code) => ({
          code,
          createdBy: userId,
        }))
      );

      return { codes };
    }),

  listUsers: adminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        characterCount: sql<number>`(
          SELECT count(*)::int FROM characters WHERE characters.user_id = ${users.id}
        )`,
      })
      .from(users)
      .orderBy(users.createdAt);

    return result;
  }),

  listInvites: adminProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        id: invites.id,
        code: invites.code,
        createdBy: invites.createdBy,
        usedBy: invites.usedBy,
        usedAt: invites.usedAt,
        expiresAt: invites.expiresAt,
        createdAt: invites.createdAt,
      })
      .from(invites)
      .orderBy(invites.createdAt);

    return result;
  }),

  isAdmin: protectedProcedure.query(({ ctx }) => {
    return { isAdmin: isAdmin(ctx.session.user?.email) };
  }),

  getActivity: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [recentSignups, recentCharacters, topCharacters, [activeCount]] =
      await Promise.all([
        ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(desc(users.createdAt))
          .limit(10),

        ctx.db
          .select({
            id: characters.id,
            name: characters.name,
            class: characters.class,
            theme: characters.theme,
            level: characters.level,
            createdAt: characters.createdAt,
          })
          .from(characters)
          .orderBy(desc(characters.createdAt))
          .limit(10),

        ctx.db
          .select({
            id: characters.id,
            name: characters.name,
            class: characters.class,
            theme: characters.theme,
            level: characters.level,
            xp: characters.xp,
            gold: characters.gold,
          })
          .from(characters)
          .orderBy(desc(characters.level), desc(characters.xp))
          .limit(5),

        ctx.db
          .select({ value: count() })
          .from(characters)
          .where(gte(characters.updatedAt, oneDayAgo)),
      ]);

    return {
      recentSignups,
      recentCharacters,
      topCharacters,
      activePlayers: activeCount?.value ?? 0,
    };
  }),

  getGameEvents: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const eventLimit = input?.limit ?? 50;
      const events = await ctx.db
        .select()
        .from(gameEvents)
        .orderBy(desc(gameEvents.createdAt))
        .limit(eventLimit);

      return events;
    }),

  getAIUsage: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [dailyStats, weeklyStats, recentCalls] = await Promise.all([
      ctx.db
        .select({
          totalCalls: count(),
          totalInput: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
          totalOutput: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, oneDayAgo)),
      ctx.db
        .select({
          totalCalls: count(),
          totalInput: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
          totalOutput: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, oneWeekAgo)),
      ctx.db
        .select()
        .from(aiUsage)
        .orderBy(desc(aiUsage.createdAt))
        .limit(20),
    ]);

    const daily = dailyStats[0]!;
    const weekly = weeklyStats[0]!;

    const estimateCost = (input: number, output: number) =>
      (input / 1_000_000) * 0.80 + (output / 1_000_000) * 4.0;

    return {
      daily: {
        calls: daily.totalCalls,
        inputTokens: daily.totalInput,
        outputTokens: daily.totalOutput,
        estimatedCost: estimateCost(daily.totalInput, daily.totalOutput),
      },
      weekly: {
        calls: weekly.totalCalls,
        inputTokens: weekly.totalInput,
        outputTokens: weekly.totalOutput,
        estimatedCost: estimateCost(weekly.totalInput, weekly.totalOutput),
      },
      recentCalls,
    };
  }),

  // ─── Generation Cost Dashboard (Sprint 4) ─────────────────────────────────

  getGenerationCosts: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Cost breakdown by feature/generation type
    const byFeature = await ctx.db
      .select({
        feature: aiUsage.feature,
        calls: count(),
        inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
        avgDuration: sql<number>`coalesce(avg(${aiUsage.durationMs}), 0)::int`,
      })
      .from(aiUsage)
      .groupBy(aiUsage.feature)
      .orderBy(desc(sql`sum(${aiUsage.inputTokens}) + sum(${aiUsage.outputTokens})`));

    // Daily breakdown (last 7 days)
    const dailyBreakdown = await ctx.db
      .select({
        day: sql<string>`date_trunc('day', ${aiUsage.createdAt})::date::text`,
        calls: count(),
        inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, oneWeekAgo))
      .groupBy(sql`date_trunc('day', ${aiUsage.createdAt})`)
      .orderBy(desc(sql`date_trunc('day', ${aiUsage.createdAt})`));

    // World-gen specific stats
    const worldGenFeatures = [
      "region_generation",
      "area_generation",
      "building_generation",
    ];
    const worldGenStats = byFeature.filter((f) =>
      worldGenFeatures.includes(f.feature)
    );
    const worldGenTotal = worldGenStats.reduce(
      (sum, f) => sum + f.inputTokens + f.outputTokens,
      0,
    );

    // Template reuse stats from content library
    const templateStats = await getTemplateStats(ctx.db);

    const estimateCost = (input: number, output: number) =>
      (input / 1_000_000) * 0.80 + (output / 1_000_000) * 4.0;

    return {
      byFeature: byFeature.map((f) => ({
        ...f,
        estimatedCost: estimateCost(f.inputTokens, f.outputTokens),
      })),
      dailyBreakdown: dailyBreakdown.map((d) => ({
        ...d,
        estimatedCost: estimateCost(d.inputTokens, d.outputTokens),
      })),
      worldGen: {
        totalTokens: worldGenTotal,
        estimatedCost: estimateCost(
          worldGenStats.reduce((s, f) => s + f.inputTokens, 0),
          worldGenStats.reduce((s, f) => s + f.outputTokens, 0),
        ),
        byType: worldGenStats,
      },
      templateReuse: {
        totalEntries: templateStats.totalEntries,
        templateCount: templateStats.templateCount,
        totalReuses: templateStats.totalReuses,
        averageQuality: templateStats.averageQuality,
        estimatedTokensSaved: templateStats.totalReuses * 300, // rough estimate: ~300 tokens per reuse
      },
    };
  }),

  getLeaderboard: protectedProcedure.query(async ({ ctx }) => {
    const topCharacters = await ctx.db
      .select({
        name: characters.name,
        level: characters.level,
        class: characters.class,
        theme: characters.theme,
        gold: characters.gold,
        xp: characters.xp,
      })
      .from(characters)
      .orderBy(desc(characters.level), desc(characters.xp))
      .limit(20);

    return topCharacters;
  }),

  // ─── New: Game Data viewers ─────────────────────────────────────────────

  getClassesData: adminProcedure.query(() => {
    const overrides = readJsonFile<ClassOverrides>("class-overrides.json");

    const classes = Object.entries(CLASS_DEFINITIONS).map(([key, def]) => {
      const ovr = overrides[key];
      const abilities = Object.entries(def.abilities).map(([level, abs]) => ({
        level: Number(level),
        abilities: (abs as readonly string[]).map((a) => ({
          id: a,
          ...(ABILITY_METADATA[a] ?? { mpCost: 0, targetType: "unknown" }),
        })),
      }));

      return {
        id: key,
        name: ovr?.name ?? def.name,
        description: ovr?.description ?? def.description,
        primary: def.primary,
        hpDie: def.hpDie,
        mpBase: def.mpBase,
        startingAC: def.startingAC,
        startingStats: { ...def.startingStats },
        startingEquipment: STARTING_EQUIPMENT[key] ?? { weapon: null, armor: null },
        abilities,
      };
    });

    return classes;
  }),

  getItemTemplates: adminProcedure.query(async ({ ctx }) => {
    const mpItems = await ctx.db
      .select()
      .from(marketplaceItems)
      .orderBy(marketplaceItems.minLevel);

    return {
      templates: readJsonFile<ItemTemplate[]>("items.json"),
      marketplaceItems: mpItems,
    };
  }),

  getMonsterTemplates: adminProcedure.query(() => {
    return readJsonFile<MonsterTemplate[]>("monsters.json");
  }),

  listAllCharacters: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        classFilter: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const conditions = [];
      if (input?.search) {
        conditions.push(like(characters.name, `%${input.search}%`));
      }
      if (input?.classFilter) {
        conditions.push(eq(characters.class, input.classFilter));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [charList, [totalCount]] = await Promise.all([
        ctx.db
          .select({
            id: characters.id,
            name: characters.name,
            class: characters.class,
            theme: characters.theme,
            level: characters.level,
            xp: characters.xp,
            hp: characters.hp,
            hpMax: characters.hpMax,
            mp: characters.mp,
            mpMax: characters.mpMax,
            gold: characters.gold,
            ac: characters.ac,
            position: characters.position,
            createdAt: characters.createdAt,
            updatedAt: characters.updatedAt,
            roomCount: sql<number>`(
              SELECT count(*)::int FROM rooms WHERE rooms.character_id = ${characters.id}
            )`,
          })
          .from(characters)
          .where(where)
          .orderBy(desc(characters.level), desc(characters.xp))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ value: count() })
          .from(characters)
          .where(where),
      ]);

      return {
        characters: charList,
        total: totalCount?.value ?? 0,
      };
    }),

  getCharacterDetail: adminProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [char] = await ctx.db
        .select()
        .from(characters)
        .where(eq(characters.id, input.characterId))
        .limit(1);

      if (!char) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const [inventory, [roomCount], [loreCount]] = await Promise.all([
        ctx.db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.characterId, input.characterId)),
        ctx.db
          .select({ value: count() })
          .from(rooms)
          .where(eq(rooms.characterId, input.characterId)),
        ctx.db
          .select({ value: count() })
          .from(loreEntries)
          .where(eq(loreEntries.characterId, input.characterId)),
      ]);

      return {
        character: char,
        inventory,
        roomCount: roomCount?.value ?? 0,
        loreCount: loreCount?.value ?? 0,
      };
    }),

  getContentLibrary: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        typeFilter: z.string().optional(),
        themeFilter: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const conditions = [];
      if (input?.typeFilter) {
        conditions.push(eq(contentLibrary.type, input.typeFilter));
      }
      if (input?.themeFilter) {
        conditions.push(eq(contentLibrary.theme, input.themeFilter));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [entries, [totalCount], summaryStats] = await Promise.all([
        ctx.db
          .select()
          .from(contentLibrary)
          .where(where)
          .orderBy(desc(contentLibrary.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db
          .select({ value: count() })
          .from(contentLibrary)
          .where(where),
        ctx.db
          .select({
            type: contentLibrary.type,
            theme: contentLibrary.theme,
            count: count(),
            avgQuality: sql<number>`round(avg(${contentLibrary.quality}), 1)`,
          })
          .from(contentLibrary)
          .groupBy(contentLibrary.type, contentLibrary.theme),
      ]);

      return {
        entries,
        total: totalCount?.value ?? 0,
        summary: summaryStats,
      };
    }),

  getGameConfig: adminProcedure.query(() => {
    return {
      gameConfig: GAME_CONFIG,
      roomTypes: ROOM_TYPES,
      rarity: RARITY,
      themes: THEMES,
      xpTable: XP_TABLE,
    };
  }),

  getTemplatesData: adminProcedure.query(() => {
    return {
      templates: readJsonFile<TemplatesData>("templates.json"),
      names: readJsonFile<NamesData>("names.json"),
    };
  }),

  // ─── Sprint 2: Edit mutations ─────────────────────────────────────────────

  // TASK-021: Edit class descriptions/metadata
  updateClassMeta: adminProcedure
    .input(
      z.object({
        classId: z.string(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().min(1).max(500).optional(),
      })
    )
    .mutation(({ input }) => {
      if (!CLASS_DEFINITIONS[input.classId as CharacterClass]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Class not found" });
      }

      const overrides = readJsonFile<ClassOverrides>("class-overrides.json");

      if (!overrides[input.classId]) {
        overrides[input.classId] = {};
      }
      if (input.name !== undefined) overrides[input.classId].name = input.name;
      if (input.description !== undefined) overrides[input.classId].description = input.description;

      writeJsonFile("class-overrides.json", overrides);

      return { success: true, classId: input.classId };
    }),

  // TASK-022: Edit item descriptions/metadata
  updateItemMeta: adminProcedure
    .input(
      z.object({
        itemId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().min(1).max(500).optional(),
      })
    )
    .mutation(({ input }) => {
      const items = readJsonFile<ItemTemplate[]>("items.json");
      const item = items.find((i) => i.id === input.itemId);

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }

      if (input.name !== undefined) item.name = input.name;
      if (input.description !== undefined) item.description = input.description;

      writeJsonFile("items.json", items);

      return { success: true, itemId: input.itemId };
    }),

  // TASK-023: Edit monster descriptions/metadata
  updateMonsterMeta: adminProcedure
    .input(
      z.object({
        monsterId: z.string(),
        name: z.string().min(1).max(100).optional(),
        themes: z.array(z.string()).min(1).optional(),
      })
    )
    .mutation(({ input }) => {
      const monsters = readJsonFile<MonsterTemplate[]>("monsters.json");
      const monster = monsters.find((m) => m.id === input.monsterId);

      if (!monster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Monster not found" });
      }

      if (input.name !== undefined) monster.name = input.name;
      if (input.themes !== undefined) monster.themes = input.themes;

      writeJsonFile("monsters.json", monsters);

      return { success: true, monsterId: input.monsterId };
    }),

  // TASK-024: Edit content library entries
  updateContentEntry: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        content: z.unknown().optional(),
        quality: z.number().min(1).max(5).optional(),
        tags: z.array(z.string()).optional(),
        theme: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: contentLibrary.id })
        .from(contentLibrary)
        .where(eq(contentLibrary.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content entry not found" });
      }

      const updates: Record<string, unknown> = {};
      if (input.content !== undefined) updates.content = input.content;
      if (input.quality !== undefined) updates.quality = input.quality;
      if (input.tags !== undefined) updates.tags = input.tags;
      if (input.theme !== undefined) updates.theme = input.theme;

      if (Object.keys(updates).length > 0) {
        await ctx.db
          .update(contentLibrary)
          .set(updates)
          .where(eq(contentLibrary.id, input.id));
      }

      return { success: true, id: input.id };
    }),

  // TASK-025: Edit room templates and name pools
  updateNamePool: adminProcedure
    .input(
      z.object({
        pool: z.enum(["roomAdjectives", "roomNouns", "npcFirstNames", "npcTitles", "storeNames"]),
        entries: z.array(z.string().min(1)),
      })
    )
    .mutation(({ input }) => {
      const names = readJsonFile<NamesData>("names.json");
      names[input.pool] = input.entries;
      writeJsonFile("names.json", names);
      return { success: true, pool: input.pool, count: input.entries.length };
    }),

  addNamePoolEntry: adminProcedure
    .input(
      z.object({
        pool: z.enum(["roomAdjectives", "roomNouns", "npcFirstNames", "npcTitles", "storeNames"]),
        entry: z.string().min(1).max(100),
      })
    )
    .mutation(({ input }) => {
      const names = readJsonFile<NamesData>("names.json");
      if (!names[input.pool].includes(input.entry)) {
        names[input.pool].push(input.entry);
        writeJsonFile("names.json", names);
      }
      return { success: true, pool: input.pool, count: names[input.pool].length };
    }),

  removeNamePoolEntry: adminProcedure
    .input(
      z.object({
        pool: z.enum(["roomAdjectives", "roomNouns", "npcFirstNames", "npcTitles", "storeNames"]),
        entry: z.string(),
      })
    )
    .mutation(({ input }) => {
      const names = readJsonFile<NamesData>("names.json");
      names[input.pool] = names[input.pool].filter((e) => e !== input.entry);
      writeJsonFile("names.json", names);
      return { success: true, pool: input.pool, count: names[input.pool].length };
    }),

  updateTemplateSlot: adminProcedure
    .input(
      z.object({
        roomType: z.string(),
        theme: z.string(),
        slot: z.string(),
        entries: z.array(z.string().min(1)),
      })
    )
    .mutation(({ input }) => {
      const tpl = readJsonFile<TemplatesData>("templates.json");
      const themeData = tpl[input.roomType]?.[input.theme];
      if (!themeData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template theme not found" });
      }
      themeData.slots[input.slot] = input.entries;
      writeJsonFile("templates.json", tpl);
      return { success: true };
    }),

  updateTemplateStrings: adminProcedure
    .input(
      z.object({
        roomType: z.string(),
        theme: z.string(),
        templates: z.array(z.string().min(1)),
      })
    )
    .mutation(({ input }) => {
      const tpl = readJsonFile<TemplatesData>("templates.json");
      const themeData = tpl[input.roomType]?.[input.theme];
      if (!themeData) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template theme not found" });
      }
      themeData.templates = input.templates;
      writeJsonFile("templates.json", tpl);
      return { success: true };
    }),

  // TASK-026: Edit character data (god mode)
  updateCharacterGodMode: adminProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        level: z.number().min(1).max(100).optional(),
        xp: z.number().min(0).optional(),
        xpNext: z.number().min(0).optional(),
        gold: z.number().min(0).optional(),
        hp: z.number().min(1).optional(),
        hpMax: z.number().min(1).optional(),
        mp: z.number().min(0).optional(),
        mpMax: z.number().min(0).optional(),
        ac: z.number().min(0).optional(),
        stats: z.object({
          str: z.number().min(1).max(30),
          dex: z.number().min(1).max(30),
          con: z.number().min(1).max(30),
          int: z.number().min(1).max(30),
          wis: z.number().min(1).max(30),
          cha: z.number().min(1).max(30),
        }).optional(),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        abilities: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [char] = await ctx.db
        .select({ id: characters.id, name: characters.name })
        .from(characters)
        .where(eq(characters.id, input.characterId))
        .limit(1);

      if (!char) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const { characterId, ...fields } = input;
      const updates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = value;
      }
      updates.updatedAt = new Date();

      if (Object.keys(updates).length > 1) {
        await ctx.db
          .update(characters)
          .set(updates)
          .where(eq(characters.id, characterId));

        // Log admin edit as game event
        await ctx.db.insert(gameEvents).values({
          characterId,
          characterName: char.name,
          userId: ctx.session.user.id!,
          type: "admin_edit",
          detail: `God mode edit: ${Object.keys(fields).filter((k) => fields[k as keyof typeof fields] !== undefined).join(", ")}`,
          metadata: { editedFields: fields, adminEmail: ctx.session.user.email },
        });
      }

      return { success: true, characterId };
    }),

  // ─── Sprint 3: Create/Clone/Delete mutations ─────────────────────────────

  // TASK-027: Create/Clone/Delete items
  createItem: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, "ID must be lowercase alphanumeric with underscores"),
        name: z.string().min(1).max(100),
        type: z.enum(["weapon", "armor", "potion", "scroll", "accessory"]),
        rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
        stats: z.record(z.string(), z.number()),
        basePrice: z.number().min(0),
        description: z.string().min(1).max(500),
      })
    )
    .mutation(({ input }) => {
      const items = readJsonFile<ItemTemplate[]>("items.json");
      if (items.some((i) => i.id === input.id)) {
        throw new TRPCError({ code: "CONFLICT", message: `Item "${input.id}" already exists` });
      }
      items.push(input);
      writeJsonFile("items.json", items);
      return { success: true, itemId: input.id };
    }),

  cloneItem: adminProcedure
    .input(
      z.object({
        sourceId: z.string(),
        newId: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
        newName: z.string().min(1).max(100),
      })
    )
    .mutation(({ input }) => {
      const items = readJsonFile<ItemTemplate[]>("items.json");
      const source = items.find((i) => i.id === input.sourceId);
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source item not found" });
      }
      if (items.some((i) => i.id === input.newId)) {
        throw new TRPCError({ code: "CONFLICT", message: `Item "${input.newId}" already exists` });
      }
      items.push({ ...source, id: input.newId, name: input.newName });
      writeJsonFile("items.json", items);
      return { success: true, itemId: input.newId };
    }),

  deleteItem: adminProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(({ input }) => {
      const items = readJsonFile<ItemTemplate[]>("items.json");
      const idx = items.findIndex((i) => i.id === input.itemId);
      if (idx === -1) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      items.splice(idx, 1);
      writeJsonFile("items.json", items);
      return { success: true, itemId: input.itemId };
    }),

  deleteMarketplaceItem: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(marketplaceItems).where(eq(marketplaceItems.id, input.id));
      return { success: true };
    }),

  // TASK-028: Create/Clone/Delete monsters
  createMonster: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
        name: z.string().min(1).max(100),
        level: z.number().min(1).max(20),
        hpBase: z.number().min(1),
        ac: z.number().min(0),
        attack: z.number().min(0),
        damage: z.string().min(1).max(20),
        xp: z.number().min(0),
        abilities: z.array(z.string()).default([]),
        themes: z.array(z.string()).min(1),
      })
    )
    .mutation(({ input }) => {
      const monsters = readJsonFile<MonsterTemplate[]>("monsters.json");
      if (monsters.some((m) => m.id === input.id)) {
        throw new TRPCError({ code: "CONFLICT", message: `Monster "${input.id}" already exists` });
      }
      monsters.push(input);
      writeJsonFile("monsters.json", monsters);
      return { success: true, monsterId: input.id };
    }),

  cloneMonster: adminProcedure
    .input(
      z.object({
        sourceId: z.string(),
        newId: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/),
        newName: z.string().min(1).max(100),
      })
    )
    .mutation(({ input }) => {
      const monsters = readJsonFile<MonsterTemplate[]>("monsters.json");
      const source = monsters.find((m) => m.id === input.sourceId);
      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Source monster not found" });
      }
      if (monsters.some((m) => m.id === input.newId)) {
        throw new TRPCError({ code: "CONFLICT", message: `Monster "${input.newId}" already exists` });
      }
      monsters.push({ ...source, id: input.newId, name: input.newName });
      writeJsonFile("monsters.json", monsters);
      return { success: true, monsterId: input.newId };
    }),

  deleteMonster: adminProcedure
    .input(z.object({ monsterId: z.string() }))
    .mutation(({ input }) => {
      const monsters = readJsonFile<MonsterTemplate[]>("monsters.json");
      const idx = monsters.findIndex((m) => m.id === input.monsterId);
      if (idx === -1) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Monster not found" });
      }
      monsters.splice(idx, 1);
      writeJsonFile("monsters.json", monsters);
      return { success: true, monsterId: input.monsterId };
    }),

  // TASK-029: Create/Delete content library entries
  createContentEntry: adminProcedure
    .input(
      z.object({
        type: z.string().min(1),
        theme: z.string().min(1),
        content: z.unknown(),
        quality: z.number().min(1).max(5).default(3),
        tags: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .insert(contentLibrary)
        .values({
          type: input.type,
          theme: input.theme,
          content: input.content,
          quality: input.quality,
          tags: input.tags,
        })
        .returning({ id: contentLibrary.id });

      return { success: true, id: entry!.id };
    }),

  deleteContentEntry: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: contentLibrary.id })
        .from(contentLibrary)
        .where(eq(contentLibrary.id, input.id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Content entry not found" });
      }

      await ctx.db.delete(contentLibrary).where(eq(contentLibrary.id, input.id));
      return { success: true, id: input.id };
    }),

  bulkDeleteContentEntries: adminProcedure
    .input(z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await ctx.db.delete(contentLibrary).where(eq(contentLibrary.id, id));
      }
      return { success: true, deleted: input.ids.length };
    }),

  // TASK-031: Delete characters and reset character data
  deleteCharacter: adminProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [char] = await ctx.db
        .select({ id: characters.id, name: characters.name, userId: characters.userId })
        .from(characters)
        .where(eq(characters.id, input.characterId))
        .limit(1);

      if (!char) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      // Log before deleting (cascade will remove rooms, inventory, lore, events)
      await ctx.db.insert(gameEvents).values({
        characterId: char.id,
        characterName: char.name,
        userId: ctx.session.user.id!,
        type: "admin_delete",
        detail: `Admin deleted character "${char.name}"`,
        metadata: { adminEmail: ctx.session.user.email },
      });

      // Delete character (FK cascades handle rooms, inventory, lore)
      await ctx.db.delete(characters).where(eq(characters.id, input.characterId));

      return { success: true, characterName: char.name };
    }),

  resetCharacter: adminProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [char] = await ctx.db
        .select()
        .from(characters)
        .where(eq(characters.id, input.characterId))
        .limit(1);

      if (!char) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
      }

      const classDef = CLASS_DEFINITIONS[char.class as CharacterClass];
      if (!classDef) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Invalid class" });
      }

      // Delete rooms, inventory, and lore for this character
      await Promise.all([
        ctx.db.delete(rooms).where(eq(rooms.characterId, input.characterId)),
        ctx.db.delete(inventoryItems).where(eq(inventoryItems.characterId, input.characterId)),
        ctx.db.delete(loreEntries).where(eq(loreEntries.characterId, input.characterId)),
      ]);

      // Reset character to starting state (keep name, class, theme)
      await ctx.db
        .update(characters)
        .set({
          level: 1,
          xp: 0,
          xpNext: 300,
          hp: classDef.hpDie,
          hpMax: classDef.hpDie,
          mp: classDef.mpBase,
          mpMax: classDef.mpBase,
          gold: GAME_CONFIG.STARTING_GOLD,
          stats: { ...classDef.startingStats },
          ac: classDef.startingAC,
          position: { x: 0, y: 0 },
          lastSafe: { x: 0, y: 0 },
          baseLevel: 0,
          equipment: {},
          abilities: [...(classDef.abilities[1] ?? [])],
          companion: null,
          buffs: [],
          updatedAt: new Date(),
        })
        .where(eq(characters.id, input.characterId));

      // Log the reset
      await ctx.db.insert(gameEvents).values({
        characterId: char.id,
        characterName: char.name,
        userId: ctx.session.user.id!,
        type: "admin_reset",
        detail: `Admin reset character "${char.name}" to starting state`,
        metadata: { adminEmail: ctx.session.user.email, previousLevel: char.level },
      });

      return { success: true, characterName: char.name };
    }),

  // ─── World Data Queries ──────────────────────────────────────────────────

  getWorldDataCounts: adminProcedure.query(async ({ ctx }) => {
    const [loreCount, roomCount, npcCount, storeCount, questCount] =
      await Promise.all([
        ctx.db.select({ count: count() }).from(loreEntries),
        ctx.db.select({ count: count() }).from(rooms),
        ctx.db.select({ count: count() }).from(npcs),
        ctx.db.select({ count: count() }).from(stores),
        ctx.db.select({ count: count() }).from(quests),
      ]);
    return {
      lore: loreCount[0]?.count ?? 0,
      rooms: roomCount[0]?.count ?? 0,
      npcs: npcCount[0]?.count ?? 0,
      stores: storeCount[0]?.count ?? 0,
      quests: questCount[0]?.count ?? 0,
    };
  }),

  getCharacterNames: adminProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: characters.id,
        name: characters.name,
        className: characters.class,
      })
      .from(characters)
      .orderBy(characters.name);
  }),

  getWorldLore: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        sourceFilter: z.string().optional(),
        characterFilter: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(like(loreEntries.title, `%${input.search}%`));
      }
      if (input.sourceFilter) {
        conditions.push(eq(loreEntries.source, input.sourceFilter));
      }
      if (input.characterFilter) {
        conditions.push(eq(loreEntries.characterId, input.characterFilter));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [entries, totalResult] = await Promise.all([
        ctx.db
          .select({
            id: loreEntries.id,
            characterId: loreEntries.characterId,
            characterName: characters.name,
            title: loreEntries.title,
            content: loreEntries.content,
            source: loreEntries.source,
            sourceId: loreEntries.sourceId,
            discoveredAt: loreEntries.discoveredAt,
          })
          .from(loreEntries)
          .leftJoin(characters, eq(loreEntries.characterId, characters.id))
          .where(where)
          .orderBy(desc(loreEntries.discoveredAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ count: count() }).from(loreEntries).where(where),
      ]);

      return { entries, total: totalResult[0]?.count ?? 0 };
    }),

  getWorldRooms: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        typeFilter: z.string().optional(),
        characterFilter: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(like(rooms.name, `%${input.search}%`));
      }
      if (input.typeFilter) {
        conditions.push(eq(rooms.type, input.typeFilter));
      }
      if (input.characterFilter) {
        conditions.push(eq(rooms.characterId, input.characterFilter));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [entries, totalResult] = await Promise.all([
        ctx.db
          .select({
            id: rooms.id,
            characterId: rooms.characterId,
            characterName: characters.name,
            x: rooms.x,
            y: rooms.y,
            name: rooms.name,
            type: rooms.type,
            description: rooms.description,
            exits: rooms.exits,
            depth: rooms.depth,
            hasEncounter: rooms.hasEncounter,
            encounterData: rooms.encounterData,
            hasLoot: rooms.hasLoot,
            lootData: rooms.lootData,
            visited: rooms.visited,
            roomFeatures: rooms.roomFeatures,
            createdAt: rooms.createdAt,
          })
          .from(rooms)
          .leftJoin(characters, eq(rooms.characterId, characters.id))
          .where(where)
          .orderBy(desc(rooms.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ count: count() }).from(rooms).where(where),
      ]);

      return { entries, total: totalResult[0]?.count ?? 0 };
    }),

  getWorldNpcs: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        characterFilter: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(like(npcs.name, `%${input.search}%`));
      }
      if (input.characterFilter) {
        conditions.push(eq(npcs.characterId, input.characterFilter));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [entries, totalResult] = await Promise.all([
        ctx.db
          .select({
            id: npcs.id,
            characterId: npcs.characterId,
            characterName: characters.name,
            roomX: npcs.roomX,
            roomY: npcs.roomY,
            name: npcs.name,
            description: npcs.description,
            dialogue: npcs.dialogue,
            questId: npcs.questId,
            createdAt: npcs.createdAt,
          })
          .from(npcs)
          .leftJoin(characters, eq(npcs.characterId, characters.id))
          .where(where)
          .orderBy(desc(npcs.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ count: count() }).from(npcs).where(where),
      ]);

      return { entries, total: totalResult[0]?.count ?? 0 };
    }),

  getWorldStores: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        characterFilter: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(like(stores.name, `%${input.search}%`));
      }
      if (input.characterFilter) {
        conditions.push(eq(stores.characterId, input.characterFilter));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [entries, totalResult] = await Promise.all([
        ctx.db
          .select({
            id: stores.id,
            characterId: stores.characterId,
            characterName: characters.name,
            roomX: stores.roomX,
            roomY: stores.roomY,
            name: stores.name,
            inventory: stores.inventory,
            createdAt: stores.createdAt,
          })
          .from(stores)
          .leftJoin(characters, eq(stores.characterId, characters.id))
          .where(where)
          .orderBy(desc(stores.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ count: count() }).from(stores).where(where),
      ]);

      return { entries, total: totalResult[0]?.count ?? 0 };
    }),

  // ─── World Hierarchy Browser (Sprint 4) ───────────────────────────────────

  getWorldHierarchy: adminProcedure.query(async ({ ctx }) => {
    const [worldRows, regionRows, areaRows, buildingRows, roomCount] =
      await Promise.all([
        ctx.db.select().from(worlds).orderBy(worlds.createdAt),
        ctx.db.select().from(regions).orderBy(regions.createdAt),
        ctx.db.select().from(areas).orderBy(areas.createdAt),
        ctx.db.select().from(buildings).orderBy(buildings.createdAt),
        ctx.db.select({ count: count() }).from(rooms),
      ]);

    // Build hierarchy
    const worldData = worldRows.map((w) => {
      const worldRegions = regionRows.filter((r) => r.worldId === w.id);
      return {
        ...w,
        regionCount: worldRegions.length,
        areaCount: worldRegions.reduce(
          (sum, r) => sum + areaRows.filter((a) => a.regionId === r.id).length,
          0,
        ),
        buildingCount: worldRegions.reduce((sum, r) => {
          const regionAreas = areaRows.filter((a) => a.regionId === r.id);
          return sum + regionAreas.reduce(
            (s, a) => s + buildingRows.filter((b) => b.areaId === a.id).length,
            0,
          );
        }, 0),
      };
    });

    return {
      worlds: worldData,
      stats: {
        totalWorlds: worldRows.length,
        totalRegions: regionRows.length,
        totalAreas: areaRows.length,
        totalBuildings: buildingRows.length,
        totalRooms: roomCount[0]?.count ?? 0,
      },
    };
  }),

  getRegionDetail: adminProcedure
    .input(z.object({ regionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [region] = await ctx.db
        .select()
        .from(regions)
        .where(eq(regions.id, input.regionId))
        .limit(1);

      if (!region) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Region not found" });
      }

      const regionAreas = await ctx.db
        .select()
        .from(areas)
        .where(eq(areas.regionId, input.regionId))
        .orderBy(areas.createdAt);

      return { region, areas: regionAreas };
    }),

  getAreaDetail: adminProcedure
    .input(z.object({ areaId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [area] = await ctx.db
        .select()
        .from(areas)
        .where(eq(areas.id, input.areaId))
        .limit(1);

      if (!area) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Area not found" });
      }

      const areaBuildings = await ctx.db
        .select()
        .from(buildings)
        .where(eq(buildings.areaId, input.areaId))
        .orderBy(buildings.createdAt);

      return { area, buildings: areaBuildings };
    }),

  getBuildingDetail: adminProcedure
    .input(z.object({ buildingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [building] = await ctx.db
        .select()
        .from(buildings)
        .where(eq(buildings.id, input.buildingId))
        .limit(1);

      if (!building) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
      }

      const [roomCount] = await ctx.db
        .select({ count: count() })
        .from(rooms)
        .where(eq(rooms.buildingId, input.buildingId));

      return {
        building,
        roomCount: roomCount?.count ?? 0,
      };
    }),

  // ─── Content Template Manager (Sprint 4) ──────────────────────────────────

  getTemplates: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        typeFilter: z.string().optional(),
        themeFilter: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [gte(contentLibrary.quality, 4)];
      if (input.typeFilter) conditions.push(eq(contentLibrary.type, input.typeFilter));
      if (input.themeFilter) conditions.push(eq(contentLibrary.theme, input.themeFilter));

      const where = and(...conditions);

      const [entries, totalResult] = await Promise.all([
        ctx.db
          .select()
          .from(contentLibrary)
          .where(where)
          .orderBy(desc(contentLibrary.quality), desc(contentLibrary.usageCount))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ count: count() }).from(contentLibrary).where(where),
      ]);

      return { entries, total: totalResult[0]?.count ?? 0 };
    }),

  promoteTemplate: adminProcedure
    .input(z.object({ contentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await promoteToTemplate(ctx.db, input.contentId);
      return { success: true, id: input.contentId };
    }),

  updateTemplate: adminProcedure
    .input(
      z.object({
        contentId: z.string().uuid(),
        content: z.unknown().optional(),
        quality: z.number().min(1).max(5).optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = {};
      if (input.content !== undefined) updates.content = input.content;
      if (input.quality !== undefined) updates.quality = input.quality;
      if (input.tags !== undefined) updates.tags = input.tags;

      if (Object.keys(updates).length > 0) {
        await ctx.db
          .update(contentLibrary)
          .set(updates)
          .where(eq(contentLibrary.id, input.contentId));
      }

      return { success: true, id: input.contentId };
    }),

  getTemplateStats: adminProcedure.query(async ({ ctx }) => {
    return getTemplateStats(ctx.db);
  }),

  getWorldQuests: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        search: z.string().optional(),
        typeFilter: z.string().optional(),
        statusFilter: z.string().optional(),
        characterFilter: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(like(quests.title, `%${input.search}%`));
      }
      if (input.typeFilter) {
        conditions.push(eq(quests.type, input.typeFilter));
      }
      if (input.statusFilter) {
        conditions.push(eq(quests.status, input.statusFilter));
      }
      if (input.characterFilter) {
        conditions.push(eq(quests.characterId, input.characterFilter));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [entries, totalResult] = await Promise.all([
        ctx.db
          .select({
            id: quests.id,
            characterId: quests.characterId,
            characterName: characters.name,
            type: quests.type,
            title: quests.title,
            description: quests.description,
            objectives: quests.objectives,
            rewards: quests.rewards,
            status: quests.status,
            givenBy: quests.givenBy,
            createdAt: quests.createdAt,
          })
          .from(quests)
          .leftJoin(characters, eq(quests.characterId, characters.id))
          .where(where)
          .orderBy(desc(quests.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        ctx.db.select({ count: count() }).from(quests).where(where),
      ]);

      return { entries, total: totalResult[0]?.count ?? 0 };
    }),
});
