import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { characters, inventoryItems, rooms, fogOfWar, worlds, regions, areas } from "@/server/db/schema";
import { createNewCharacter } from "@/server/game/player";
import { generateStartingRoom } from "@/server/game/world";
import { seedStarterWorld } from "@/server/game/world-seed";
import { CLASS_DEFINITIONS, THEMES } from "@/lib/constants";
import type { CharacterClass, Theme } from "@/lib/constants";
import type { Player, GameItem } from "@/lib/types";
import { buildEquipmentSlots } from "@/server/game/equipment";

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

      const slots = buildEquipmentSlots(items);

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
          weapon: slots.weapon ? toGameItem(slots.weapon) : undefined,
          armor: slots.armor ? toGameItem(slots.armor) : undefined,
          accessory: slots.accessory ? toGameItem(slots.accessory) : undefined,
          ring: slots.ring ? toGameItem(slots.ring) : undefined,
          amulet: slots.amulet ? toGameItem(slots.amulet) : undefined,
          boots: slots.boots ? toGameItem(slots.boots) : undefined,
        },
        abilities: character.abilities,
        lastSafe: character.lastSafe as Player["lastSafe"],
        baseLevel: character.baseLevel,
        buffs: (character.buffs as Player["buffs"]) ?? [],
        worldId: character.worldId ?? null,
        currentRegionId: character.currentRegionId ?? null,
        currentAreaId: character.currentAreaId ?? null,
        currentBuildingId: character.currentBuildingId ?? null,
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

      // Check for duplicate character name (case-insensitive)
      const [existing] = await ctx.db
        .select({ id: characters.id })
        .from(characters)
        .where(eq(characters.name, input.name));

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A character named "${input.name}" already exists. Choose a different name.`,
        });
      }

      // Generate character data from game engine
      const { character: charData, inventoryItems: startingItems } =
        createNewCharacter(input.name, characterClass, theme);

      // ── Look up or seed the shared world ────────────────────────────────────
      let world = await ctx.db.query.worlds.findFirst({
        where: (w, { eq: weq }) => weq(w.name, "Aethermoor"),
      });
      if (!world) {
        world = await seedStarterWorld();
      }

      // Find starting region and area
      const worldRegions = await ctx.db
        .select()
        .from(regions)
        .where(eq(regions.worldId, world.id));
      const startingRegion = worldRegions[0]!;

      const regionAreas = await ctx.db
        .select()
        .from(areas)
        .where(eq(areas.regionId, startingRegion.id));
      // Pick first town area, or first area
      const startingArea =
        regionAreas.find((a) => a.areaType === "town") ?? regionAreas[0]!;

      // Starting position: center of the area grid
      const startX = Math.floor(startingArea.gridWidth / 2);
      const startY = Math.floor(startingArea.gridHeight / 2);

      // Insert character with worldId and starting position
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
          position: { x: startX, y: startY },
          equipment: charData.equipment,
          abilities: charData.abilities,
          lastSafe: { x: startX, y: startY },
          baseLevel: charData.baseLevel,
          worldId: world.id,
          currentRegionId: startingRegion.id,
          currentAreaId: startingArea.id,
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

      // ── Create initial fog_of_war entries ───────────────────────────────────
      await ctx.db.insert(fogOfWar).values([
        {
          characterId: newCharacter!.id,
          entityType: "region",
          entityId: startingRegion.id,
        },
        {
          characterId: newCharacter!.id,
          entityType: "area",
          entityId: startingArea.id,
        },
      ]);

      // ── Generate starting room with hierarchy fields ────────────────────────
      const roomData = generateStartingRoom(newCharacter!.id, theme);

      // Check if a shared room already exists at this position in this area
      const [existingSharedRoom] = await ctx.db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.areaId, startingArea.id),
            eq(rooms.x, startX),
            eq(rooms.y, startY)
          )
        );

      if (!existingSharedRoom) {
        await ctx.db.insert(rooms).values({
          characterId: null, // shared room
          x: startX,
          y: startY,
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
          worldId: world.id,
          regionId: startingRegion.id,
          areaId: startingArea.id,
        });
      }

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
