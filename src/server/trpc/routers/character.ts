import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { characters, inventoryItems, rooms } from "@/server/db/schema";
import { createNewCharacter } from "@/server/game/player";
import { generateStartingRoom } from "@/server/game/world";
import { CLASS_DEFINITIONS, THEMES } from "@/lib/constants";
import type { CharacterClass, Theme } from "@/lib/constants";
import type { Player, GameItem } from "@/lib/types";

const characterClasses = Object.keys(CLASS_DEFINITIONS) as [string, ...string[]];
const themeKeys = Object.keys(THEMES) as [string, ...string[]];

export const characterRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id!;
    const result = await ctx.db
      .select({
        id: characters.id,
        name: characters.name,
        class: characters.class,
        theme: characters.theme,
        level: characters.level,
        createdAt: characters.createdAt,
      })
      .from(characters)
      .where(eq(characters.userId, userId));

    return result;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;

      const [character] = await ctx.db
        .select()
        .from(characters)
        .where(and(eq(characters.id, input.id), eq(characters.userId, userId)));

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      // Fetch inventory items
      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, input.id));

      // Build equipment from equipped items
      const equippedWeapon = items.find(
        (i) => i.type === "weapon" && i.isEquipped
      );
      const equippedArmor = items.find(
        (i) => i.type === "armor" && i.isEquipped
      );
      const equippedAccessory = items.find(
        (i) => i.type === "accessory" && i.isEquipped
      );

      const toGameItem = (item: typeof items[number]): GameItem => ({
        id: item.id,
        itemId: item.itemId,
        name: item.name,
        type: item.type as GameItem["type"],
        rarity: item.rarity as GameItem["rarity"],
        stats: (item.stats ?? {}) as Record<string, number>,
        quantity: item.quantity,
        slot: item.slot,
        isEquipped: item.isEquipped,
      });

      const player: Player = {
        id: character.id,
        name: character.name,
        class: character.class,
        theme: character.theme,
        level: character.level,
        xp: character.xp,
        xpNext: character.xpNext,
        hp: character.hp,
        hpMax: character.hpMax,
        mp: character.mp,
        mpMax: character.mpMax,
        gold: character.gold,
        stats: character.stats as Player["stats"],
        ac: character.ac,
        position: character.position as Player["position"],
        equipment: {
          weapon: equippedWeapon ? toGameItem(equippedWeapon) : undefined,
          armor: equippedArmor ? toGameItem(equippedArmor) : undefined,
          accessory: equippedAccessory
            ? toGameItem(equippedAccessory)
            : undefined,
        },
        abilities: character.abilities,
        lastSafe: character.lastSafe as Player["lastSafe"],
        baseLevel: character.baseLevel,
        buffs: (character.buffs as Player["buffs"]) ?? [],
      };

      return player;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(32),
        class: z.enum(characterClasses),
        theme: z.enum(themeKeys),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const characterClass = input.class as CharacterClass;
      const theme = input.theme as Theme;

      // Generate character data from game engine
      const { character: charData, inventoryItems: startingItems } =
        createNewCharacter(input.name, characterClass, theme);

      // Insert character
      const [newCharacter] = await ctx.db
        .insert(characters)
        .values({
          userId,
          name: charData.name,
          class: charData.class,
          theme: charData.theme,
          level: charData.level,
          xp: charData.xp,
          xpNext: charData.xpNext,
          hp: charData.hp,
          hpMax: charData.hpMax,
          mp: charData.mp,
          mpMax: charData.mpMax,
          gold: charData.gold,
          stats: charData.stats,
          ac: charData.ac,
          position: charData.position,
          equipment: charData.equipment,
          abilities: charData.abilities,
          lastSafe: charData.lastSafe,
          baseLevel: charData.baseLevel,
        })
        .returning();

      // Insert starting inventory items
      if (startingItems.length > 0) {
        await ctx.db.insert(inventoryItems).values(
          startingItems.map((item) => ({
            characterId: newCharacter!.id,
            itemId: item.itemId,
            name: item.name,
            type: item.type,
            rarity: item.rarity,
            stats: item.stats,
            quantity: item.quantity,
            isEquipped: item.isEquipped,
          }))
        );
      }

      // Generate and insert starting room
      const roomData = generateStartingRoom(newCharacter!.id, theme);
      await ctx.db.insert(rooms).values({
        characterId: roomData.characterId,
        x: roomData.x,
        y: roomData.y,
        name: roomData.name,
        type: roomData.type,
        description: roomData.description,
        exits: roomData.exits,
        depth: roomData.depth,
        hasEncounter: roomData.hasEncounter,
        encounterData: roomData.encounterData,
        hasLoot: roomData.hasLoot,
        lootData: roomData.lootData,
        visited: roomData.visited,
        roomFeatures: roomData.roomFeatures,
      });

      return newCharacter!;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;

      // Verify ownership
      const [character] = await ctx.db
        .select({ id: characters.id })
        .from(characters)
        .where(and(eq(characters.id, input.id), eq(characters.userId, userId)));

      if (!character) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Character not found",
        });
      }

      // Delete character (cascade handles related data)
      await ctx.db
        .delete(characters)
        .where(eq(characters.id, input.id));

      return { success: true };
    }),
});
