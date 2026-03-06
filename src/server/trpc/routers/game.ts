import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { characters, rooms, inventoryItems } from "@/server/db/schema";
import { generateRoom } from "@/server/game/world";
import { generateEncounter } from "@/server/game/encounters";
import { computeMapViewport, directionToOffset, oppositeDirection, roomKey } from "@/server/game/map";
import { rollCheck, rollDice } from "@/server/game/dice";
import { statModifier, GAME_CONFIG } from "@/lib/constants";
import type { Theme } from "@/lib/constants";
import itemsData from "@/server/gamedata/items.json";
import themesData from "@/server/gamedata/themes.json";
import type {
  Player,
  Room as RoomType,
  Position,
  MonsterEncounter,
  GameItem,
  Stats,
  Direction,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Player object from a character DB row + inventory items */
function buildPlayer(
  character: typeof characters.$inferSelect,
  items: (typeof inventoryItems.$inferSelect)[]
): Player {
  const toGameItem = (item: (typeof inventoryItems.$inferSelect)): GameItem => ({
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

  const equippedWeapon = items.find((i) => i.type === "weapon" && i.isEquipped);
  const equippedArmor = items.find((i) => i.type === "armor" && i.isEquipped);
  const equippedAccessory = items.find((i) => i.type === "accessory" && i.isEquipped);

  return {
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
    stats: character.stats as Stats,
    ac: character.ac,
    position: character.position as Position,
    equipment: {
      weapon: equippedWeapon ? toGameItem(equippedWeapon) : undefined,
      armor: equippedArmor ? toGameItem(equippedArmor) : undefined,
      accessory: equippedAccessory ? toGameItem(equippedAccessory) : undefined,
    },
    abilities: character.abilities,
    lastSafe: character.lastSafe as Position,
    baseLevel: character.baseLevel,
  };
}

/** Build a typed Room from a DB row */
function buildRoom(row: typeof rooms.$inferSelect): RoomType {
  return {
    id: row.id,
    x: row.x,
    y: row.y,
    name: row.name,
    type: row.type,
    description: row.description,
    exits: row.exits,
    depth: row.depth,
    hasEncounter: row.hasEncounter,
    encounterData: row.encounterData as MonsterEncounter | null,
    hasLoot: row.hasLoot,
    lootData: row.lootData as GameItem[] | null,
    visited: row.visited,
    roomFeatures: (row.roomFeatures ?? {}) as Record<string, unknown>,
  };
}

type DbClient = typeof import("@/server/db").db;

/** Get character + verify ownership. Throws NOT_FOUND or FORBIDDEN. */
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

/** Get the room at a given position for a character */
async function getRoomAt(
  db: DbClient,
  characterId: string,
  x: number,
  y: number
) {
  const [room] = await db
    .select()
    .from(rooms)
    .where(
      and(eq(rooms.characterId, characterId), eq(rooms.x, x), eq(rooms.y, y))
    );
  return room ?? null;
}

/** Convert an array of DB room rows into a Map<string, Room> keyed by "x,y" */
function buildRoomMap(rows: (typeof rooms.$inferSelect)[]): Map<string, RoomType> {
  const map = new Map<string, RoomType>();
  for (const row of rows) {
    map.set(roomKey(row.x, row.y), buildRoom(row));
  }
  return map;
}

/** Generate loot items from gamedata/items.json for a given depth */
function generateLootItems(depth: number): GameItem[] {
  // Simple loot: 1-2 items scaled by depth
  const count = Math.random() < 0.3 ? 2 : 1;
  const loot: GameItem[] = [];

  const items = itemsData as unknown as Array<{
    id: string;
    name: string;
    type: string;
    rarity: string;
    stats: Record<string, number>;
    basePrice: number;
    description: string;
  }>;

  // Filter by rarity based on depth
  const rarityPool: string[] = ["common"];
  if (depth >= 2) rarityPool.push("uncommon");
  if (depth >= 5) rarityPool.push("rare");
  if (depth >= 8) rarityPool.push("epic");
  if (depth >= 12) rarityPool.push("legendary");

  const eligible = items.filter((i) => rarityPool.includes(i.rarity));
  if (eligible.length === 0) return [];

  for (let i = 0; i < count; i++) {
    const template = eligible[Math.floor(Math.random() * eligible.length)]!;
    loot.push({
      id: `loot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      itemId: template.id,
      name: template.name,
      type: template.type as GameItem["type"],
      rarity: template.rarity as GameItem["rarity"],
      stats: { ...template.stats },
      quantity: 1,
      slot: null,
      isEquipped: false,
      description: template.description,
    });
  }

  return loot;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const directionSchema = z.enum(["north", "south", "east", "west"]);

export const gameRouter = router({
  // ─── Move ───────────────────────────────────────────────────────────────────
  move: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        direction: directionSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;

      // Get current room
      const currentRoomRow = await getRoomAt(ctx.db, character.id, position.x, position.y);
      if (!currentRoomRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      // Validate direction is available
      if (!currentRoomRow.exits.includes(input.direction)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No exit to the ${input.direction}`,
        });
      }

      // Calculate target position
      const offset = directionToOffset(input.direction);
      const targetX = position.x + offset.x;
      const targetY = position.y + offset.y;
      const targetDepth = Math.abs(targetX) + Math.abs(targetY);

      // Check if target room exists
      let targetRoomRow = await getRoomAt(ctx.db, character.id, targetX, targetY);

      if (!targetRoomRow) {
        // Generate new room
        const theme = character.theme as Theme;
        const newRoom = generateRoom(
          character.id,
          targetX,
          targetY,
          theme,
          targetDepth,
          input.direction
        );

        // Generate encounter data if room has encounter
        let encounterData: MonsterEncounter | null = null;
        if (newRoom.hasEncounter) {
          encounterData = generateEncounter(character.level, targetDepth, theme);
        }

        // Generate loot data if room has loot
        let lootData: GameItem[] | null = null;
        if (newRoom.hasLoot) {
          lootData = generateLootItems(targetDepth);
        }

        // Insert into DB
        const [inserted] = await ctx.db
          .insert(rooms)
          .values({
            characterId: character.id,
            x: targetX,
            y: targetY,
            name: newRoom.name,
            type: newRoom.type,
            description: newRoom.description,
            exits: newRoom.exits,
            depth: newRoom.depth,
            hasEncounter: newRoom.hasEncounter,
            encounterData,
            hasLoot: newRoom.hasLoot,
            lootData,
            visited: true,
            roomFeatures: newRoom.roomFeatures,
          })
          .returning();

        targetRoomRow = inserted!;
      } else {
        // Mark as visited if not already
        if (!targetRoomRow.visited) {
          await ctx.db
            .update(rooms)
            .set({ visited: true })
            .where(eq(rooms.id, targetRoomRow.id));
          targetRoomRow = { ...targetRoomRow, visited: true };
        }
      }

      // Update character position
      const newPosition = { x: targetX, y: targetY };
      await ctx.db
        .update(characters)
        .set({ position: newPosition, updatedAt: new Date() })
        .where(eq(characters.id, character.id));

      // Fetch inventory for player object
      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = { ...character, position: newPosition };
      const player = buildPlayer(updatedCharacter, items);
      const room = buildRoom(targetRoomRow);

      // Check for encounter
      let encounter: MonsterEncounter | null = null;
      if (room.hasEncounter && room.encounterData) {
        encounter = room.encounterData;
      }

      // Compute map viewport
      const allRooms = await ctx.db
        .select()
        .from(rooms)
        .where(eq(rooms.characterId, character.id));

      const mapViewport = computeMapViewport(
        newPosition,
        buildRoomMap(allRooms)
      );

      const enterCombat = encounter !== null;

      return { room, player, encounter, enterCombat, mapViewport };
    }),

  // ─── Get Map ────────────────────────────────────────────────────────────────
  getMap: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;

      const allRooms = await ctx.db
        .select()
        .from(rooms)
        .where(eq(rooms.characterId, character.id));

      const mapViewport = computeMapViewport(
        position,
        buildRoomMap(allRooms)
      );

      return mapViewport;
    }),

  // ─── Search Room ────────────────────────────────────────────────────────────
  searchRoom: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;
      const stats = character.stats as Stats;

      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y);
      if (!currentRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      const features = (currentRoom.roomFeatures ?? {}) as Record<string, unknown>;

      // Check if already searched
      if (features.searched) {
        return {
          success: false,
          message: "You have already thoroughly searched this room.",
        };
      }

      // Roll INT or WIS check (whichever is higher)
      const intMod = statModifier(stats.int);
      const wisMod = statModifier(stats.wis);
      const bestMod = Math.max(intMod, wisMod);
      const dc = 10 + Math.floor(currentRoom.depth / 2);
      const check = rollCheck(bestMod, dc);

      // Mark room as searched
      const updatedFeatures = { ...features, searched: true };

      if (check.success) {
        const results: {
          success: true;
          message: string;
          items?: GameItem[];
          newExits?: string[];
        } = {
          success: true,
          message: check.critical
            ? "Critical success! You find something remarkable!"
            : "Your keen senses reveal hidden secrets.",
        };

        // Chance of hidden items
        if (Math.random() < 0.5) {
          const loot = generateLootItems(currentRoom.depth);
          if (loot.length > 0) {
            results.items = loot;
            results.message += ` You discover ${loot.map((l) => l.name).join(", ")}!`;

            // Add to character inventory
            for (const item of loot) {
              await ctx.db.insert(inventoryItems).values({
                characterId: character.id,
                itemId: item.itemId,
                name: item.name,
                type: item.type,
                rarity: item.rarity,
                stats: item.stats,
                quantity: item.quantity,
                isEquipped: false,
              });
            }
          }
        }

        // Chance of secret exits
        if (Math.random() < 0.3) {
          const allDirs: Direction[] = ["north", "south", "east", "west"];
          const currentExits = currentRoom.exits;
          const missingExits = allDirs.filter((d) => !currentExits.includes(d));
          if (missingExits.length > 0) {
            const newExit = missingExits[Math.floor(Math.random() * missingExits.length)]!;
            const newExits = [...currentExits, newExit];
            await ctx.db
              .update(rooms)
              .set({ exits: newExits, roomFeatures: updatedFeatures })
              .where(eq(rooms.id, currentRoom.id));
            results.newExits = [newExit];
            results.message += ` You discover a hidden passage to the ${newExit}!`;
            return results;
          }
        }

        await ctx.db
          .update(rooms)
          .set({ roomFeatures: updatedFeatures })
          .where(eq(rooms.id, currentRoom.id));

        if (!results.items && !results.newExits) {
          const themeContent = (themesData as Record<string, { loreFragments: string[] }>);
          const theme = character.theme as Theme;
          const lore = themeContent[theme]?.loreFragments ?? [];
          if (lore.length > 0) {
            const fragment = lore[Math.floor(Math.random() * lore.length)]!;
            results.message = fragment;
          }
        }

        return results;
      }

      // Failure
      await ctx.db
        .update(rooms)
        .set({ roomFeatures: updatedFeatures })
        .where(eq(rooms.id, currentRoom.id));

      return {
        success: false,
        message: check.fumble
          ? "You trip and stumble, finding nothing but your own embarrassment."
          : "You find nothing of interest.",
      };
    }),

  // ─── Interact ───────────────────────────────────────────────────────────────
  interact: protectedProcedure
    .input(
      z.object({
        characterId: z.string().uuid(),
        feature: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;
      const stats = character.stats as Stats;

      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y);
      if (!currentRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      const features = (currentRoom.roomFeatures ?? {}) as Record<string, unknown>;

      // Check the feature exists in room
      if (!(input.feature in features)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `There is no ${input.feature} here.`,
        });
      }

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      switch (input.feature) {
        // ── Chest ──────────────────────────────────────────────
        case "chest": {
          if ((features.chest_opened as boolean | undefined) === true) {
            return { result: "The chest is already open and empty." };
          }

          // Grant loot
          const loot = currentRoom.lootData
            ? (currentRoom.lootData as unknown as GameItem[])
            : generateLootItems(currentRoom.depth);

          const grantedItems: GameItem[] = [];
          for (const item of loot) {
            const [inserted] = await ctx.db
              .insert(inventoryItems)
              .values({
                characterId: character.id,
                itemId: item.itemId,
                name: item.name,
                type: item.type,
                rarity: item.rarity,
                stats: item.stats,
                quantity: item.quantity,
                isEquipped: false,
              })
              .returning();

            grantedItems.push({
              ...item,
              id: inserted!.id,
            });
          }

          // Mark chest as opened
          const updatedFeatures = { ...features, chest_opened: true };
          await ctx.db
            .update(rooms)
            .set({ roomFeatures: updatedFeatures })
            .where(eq(rooms.id, currentRoom.id));

          // Refresh items for player build
          const refreshedItems = await ctx.db
            .select()
            .from(inventoryItems)
            .where(eq(inventoryItems.characterId, character.id));

          const player = buildPlayer(character, refreshedItems);

          return {
            result: `You open the chest and find: ${grantedItems.map((i) => i.name).join(", ")}!`,
            player,
            items: grantedItems,
          };
        }

        // ── Altar / Shrine ─────────────────────────────────────
        case "altar": {
          if ((features.blessing_available as boolean | undefined) === false) {
            return { result: "The altar's blessing has already been bestowed." };
          }

          // Heal to full
          await ctx.db
            .update(characters)
            .set({
              hp: character.hpMax,
              mp: character.mpMax,
              updatedAt: new Date(),
            })
            .where(eq(characters.id, character.id));

          // Mark blessing used
          const updatedFeatures = { ...features, blessing_available: false };
          await ctx.db
            .update(rooms)
            .set({ roomFeatures: updatedFeatures })
            .where(eq(rooms.id, currentRoom.id));

          const healedCharacter = { ...character, hp: character.hpMax, mp: character.mpMax };
          const player = buildPlayer(healedCharacter, items);

          return {
            result: "Divine light washes over you. Your HP and MP are fully restored!",
            player,
          };
        }

        // ── Campfire / Safe Room ───────────────────────────────
        case "campfire": {
          // Heal to full and update last safe
          const newPosition = character.position as Position;
          await ctx.db
            .update(characters)
            .set({
              hp: character.hpMax,
              mp: character.mpMax,
              lastSafe: newPosition,
              updatedAt: new Date(),
            })
            .where(eq(characters.id, character.id));

          const healedCharacter = {
            ...character,
            hp: character.hpMax,
            mp: character.mpMax,
            lastSafe: newPosition,
          };
          const player = buildPlayer(healedCharacter, items);

          return {
            result: "You rest by the campfire. HP and MP fully restored. Safe point updated.",
            player,
          };
        }

        // ── Trap ───────────────────────────────────────────────
        case "trap": {
          const trapData = features.trap as {
            type: string;
            dc: number;
            damage: string;
          } | undefined;

          if (!trapData) {
            return { result: "The trap has already been disarmed." };
          }

          if ((features.trap_resolved as boolean | undefined) === true) {
            return { result: "This trap has already been dealt with." };
          }

          // DEX check vs trap DC
          const dexMod = statModifier(stats.dex);
          const check = rollCheck(dexMod, trapData.dc);

          const updatedFeatures = { ...features, trap_resolved: true };
          await ctx.db
            .update(rooms)
            .set({ roomFeatures: updatedFeatures })
            .where(eq(rooms.id, currentRoom.id));

          if (check.success) {
            return {
              result: check.critical
                ? "With incredible reflexes, you not only avoid the trap but disarm it completely!"
                : `You deftly avoid the ${trapData.type} trap!`,
            };
          }

          // Take damage
          const damage = rollDice(trapData.damage);
          const newHp = Math.max(0, character.hp - damage);

          await ctx.db
            .update(characters)
            .set({ hp: newHp, updatedAt: new Date() })
            .where(eq(characters.id, character.id));

          const damagedCharacter = { ...character, hp: newHp };
          const player = buildPlayer(damagedCharacter, items);

          return {
            result: check.fumble
              ? `You stumble right into the ${trapData.type} trap! You take ${damage} damage!`
              : `The ${trapData.type} trap catches you! You take ${damage} damage.`,
            player,
          };
        }

        default: {
          return {
            result: `You examine the ${input.feature}, but nothing happens.`,
          };
        }
      }
    }),

  // ─── Rest ───────────────────────────────────────────────────────────────────
  rest: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);
      const position = character.position as Position;

      const currentRoom = await getRoomAt(ctx.db, character.id, position.x, position.y);
      if (!currentRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Current room not found" });
      }

      if (currentRoom.type !== "safe_room") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can only rest in a safe room.",
        });
      }

      // Heal to full and update last safe
      await ctx.db
        .update(characters)
        .set({
          hp: character.hpMax,
          mp: character.mpMax,
          lastSafe: position,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = {
        ...character,
        hp: character.hpMax,
        mp: character.mpMax,
        lastSafe: position,
      };

      return buildPlayer(updatedCharacter, items);
    }),

  // ─── Visit Base ────────────────────────────────────────────────────────────
  visitBase: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      if (character.baseLevel < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Base is not yet unlocked. Reach level ${GAME_CONFIG.BASE_UNLOCK_LEVEL} to unlock your base.`,
        });
      }

      // Save current position for return
      const currentPosition = character.position as Position;
      const basePosition: Position = { x: 0, y: 0 };

      await ctx.db
        .update(characters)
        .set({
          position: basePosition,
          lastSafe: currentPosition,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      // Get base room
      const baseRoom = await getRoomAt(ctx.db, character.id, 0, 0);
      if (!baseRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base room not found" });
      }

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = {
        ...character,
        position: basePosition,
        lastSafe: currentPosition,
      };
      const player = buildPlayer(updatedCharacter, items);
      const room = buildRoom(baseRoom);

      return { player, room };
    }),

  // ─── Fast Travel to Base ────────────────────────────────────────────────────
  fastTravelBase: protectedProcedure
    .input(z.object({ characterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id!;
      const character = await getOwnedCharacter(ctx.db, input.characterId, userId);

      if (character.baseLevel < 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Base is not yet unlocked. Reach level ${GAME_CONFIG.BASE_UNLOCK_LEVEL} to unlock your base.`,
        });
      }

      // Set position to origin
      const basePosition: Position = { x: 0, y: 0 };
      await ctx.db
        .update(characters)
        .set({
          position: basePosition,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, character.id));

      // Get base room
      const baseRoom = await getRoomAt(ctx.db, character.id, 0, 0);
      if (!baseRoom) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Base room not found" });
      }

      const items = await ctx.db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.characterId, character.id));

      const updatedCharacter = { ...character, position: basePosition };
      const player = buildPlayer(updatedCharacter, items);
      const room = buildRoom(baseRoom);

      return { player, room };
    }),
});
