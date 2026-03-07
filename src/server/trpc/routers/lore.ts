import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { characters, loreEntries, playerNotes } from "@/server/db/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DbClient = typeof import("@/server/db").db;

async function verifyOwnership(
  db: DbClient,
  characterId: string,
  userId: string
) {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId));

  if (!character) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Character not found" });
  }
  if (character.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your character" });
  }
  return character;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const loreRouter = router({
  // ─── List lore entries ──────────────────────────────────────────────────
  list: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        source: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await verifyOwnership(ctx.db, input.characterId, userId);

      const conditions = [eq(loreEntries.characterId, input.characterId)];

      const rows = await ctx.db
        .select()
        .from(loreEntries)
        .where(and(...conditions))
        .orderBy(desc(loreEntries.discoveredAt));

      // Filter by source in JS if provided (avoids dynamic SQL building)
      if (input.source) {
        return rows.filter((r) => r.source === input.source);
      }
      return rows;
    }),

  // ─── Add lore entry ─────────────────────────────────────────────────────
  add: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(2000),
        source: z.enum(["room", "npc", "item", "search", "combat"]),
        sourceId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await verifyOwnership(ctx.db, input.characterId, userId);

      const [entry] = await ctx.db
        .insert(loreEntries)
        .values({
          characterId: input.characterId,
          title: input.title,
          content: input.content,
          source: input.source,
          sourceId: input.sourceId,
        })
        .returning();

      return entry!;
    }),

  // ─── Get lore context for AI generation ─────────────────────────────────
  // Returns a condensed summary of discovered lore for injection into AI prompts
  context: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await verifyOwnership(ctx.db, input.characterId, userId);

      const rows = await ctx.db
        .select({ title: loreEntries.title, content: loreEntries.content })
        .from(loreEntries)
        .where(eq(loreEntries.characterId, input.characterId))
        .orderBy(desc(loreEntries.discoveredAt))
        .limit(input.limit);

      // Build a compact string for AI context injection
      return rows
        .map((r) => `[${r.title}]: ${r.content}`)
        .join("\n");
    }),

  // ─── List player notes ──────────────────────────────────────────────────
  notesList: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await verifyOwnership(ctx.db, input.characterId, userId);

      return ctx.db
        .select()
        .from(playerNotes)
        .where(eq(playerNotes.characterId, input.characterId))
        .orderBy(desc(playerNotes.createdAt));
    }),

  // ─── Add player note ───────────────────────────────────────────────────
  notesAdd: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await verifyOwnership(ctx.db, input.characterId, userId);

      const [note] = await ctx.db
        .insert(playerNotes)
        .values({
          characterId: input.characterId,
          content: input.content,
        })
        .returning();

      return note!;
    }),

  // ─── Delete player note ─────────────────────────────────────────────────
  notesDelete: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        noteId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      await verifyOwnership(ctx.db, input.characterId, userId);

      const [note] = await ctx.db
        .select()
        .from(playerNotes)
        .where(
          and(
            eq(playerNotes.id, input.noteId),
            eq(playerNotes.characterId, input.characterId)
          )
        );

      if (!note) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      await ctx.db
        .delete(playerNotes)
        .where(eq(playerNotes.id, input.noteId));

      return { success: true };
    }),
});
