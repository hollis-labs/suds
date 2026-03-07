import { z } from "zod";
import { sql, count, eq, isNotNull, desc, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  users,
  characters,
  rooms,
  invites,
  gameEvents,
  aiUsage,
} from "@/server/db/schema";
import crypto from "crypto";

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
        // Recent user signups (last 10)
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

        // Recent character creations (last 10)
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

        // Highest level characters (top 5)
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

        // Active players count (characters updated in last 24h)
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
      // Last 24h totals
      ctx.db
        .select({
          totalCalls: count(),
          totalInput: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
          totalOutput: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, oneDayAgo)),
      // Last 7d totals
      ctx.db
        .select({
          totalCalls: count(),
          totalInput: sql<number>`coalesce(sum(${aiUsage.inputTokens}), 0)::int`,
          totalOutput: sql<number>`coalesce(sum(${aiUsage.outputTokens}), 0)::int`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, oneWeekAgo)),
      // Last 20 calls
      ctx.db
        .select()
        .from(aiUsage)
        .orderBy(desc(aiUsage.createdAt))
        .limit(20),
    ]);

    const daily = dailyStats[0]!;
    const weekly = weeklyStats[0]!;

    // Rough cost estimate: Haiku input $0.80/MTok, output $4/MTok
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
});
