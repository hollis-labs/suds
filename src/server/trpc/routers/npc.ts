import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { characters, rooms, npcs } from "@/server/db/schema";
import { generateNPC } from "@/server/game/npc";
import { generateNPCDialogueAI } from "@/server/game/ai";
import type { Position, DialogueNode, NPC } from "@/lib/types";
import type { Theme } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type DbClient = typeof import("@/server/db").db;

async function getOwnedCharacter(
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

export const npcRouter = router({
  // ─── Talk to NPC ──────────────────────────────────────────────────────────
  talk: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        nodeId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(
        ctx.db,
        input.characterId,
        userId
      );
      const position = character.position as Position;

      // Get current room
      const [currentRoom] = await ctx.db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.characterId, character.id),
            eq(rooms.x, position.x),
            eq(rooms.y, position.y)
          )
        );

      if (!currentRoom) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Current room not found",
        });
      }

      if (currentRoom.type !== "npc_room") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is no one to talk to here.",
        });
      }

      // Check for existing NPC at this position
      let [npcRow] = await ctx.db
        .select()
        .from(npcs)
        .where(
          and(
            eq(npcs.characterId, character.id),
            eq(npcs.roomX, position.x),
            eq(npcs.roomY, position.y)
          )
        );

      // Generate NPC if none exists
      if (!npcRow) {
        const depth = Math.abs(position.x) + Math.abs(position.y);
        const theme = character.theme as Theme;
        const generated = generateNPC(theme, depth);

        // Enhance dialogue with AI (falls back to word bank automatically)
        const aiDialogue = await generateNPCDialogueAI(theme, generated.name, depth);
        generated.dialogue = aiDialogue;

        const [inserted] = await ctx.db
          .insert(npcs)
          .values({
            characterId: character.id,
            roomX: position.x,
            roomY: position.y,
            name: generated.name,
            description: generated.description,
            dialogue: generated.dialogue,
          })
          .returning();

        npcRow = inserted!;
      }

      const dialogue = npcRow.dialogue as Record<string, DialogueNode>;

      // Determine which node to return
      const nodeId = input.nodeId ?? "root";
      const currentNode = dialogue[nodeId];

      if (!currentNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Dialogue node "${nodeId}" not found.`,
        });
      }

      const npc: NPC = {
        id: npcRow.id,
        name: npcRow.name,
        description: npcRow.description ?? "",
        dialogue,
        currentNode: nodeId,
      };

      return { npc, currentNode };
    }),

  // ─── Get Quests (stub for P1) ─────────────────────────────────────────────
  getQuests: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        npcId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      // Verify ownership
      await getOwnedCharacter(ctx.db, input.characterId, userId);

      // Stub: return empty array for now
      return [];
    }),
});
